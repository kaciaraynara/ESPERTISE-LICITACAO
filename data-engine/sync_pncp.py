#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
EXPERTISE LICITATÓRIA — MOTOR DE INGESTÃO CONTÍNUA PNCP
=============================================================================
Script: sync_pncp.py
Descrição: Ingestão de dados resiliente, automática e de alta performance
           conectando à API Oficial do PNCP (Portal Nacional de Contratações
           Públicas) e persistindo via UPSERT no PostgreSQL (Neon) com chave
           única numero_controle_pncp.
=============================================================================
"""

import os
import sys
import time
import json
import logging
import hashlib
import argparse
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from typing import Dict, Any, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO DE AMBIENTE (.env)
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Procura .env local em data-engine, na raiz ou no backend
for env_candidate in [
    os.path.join(BASE_DIR, ".env"),
    os.path.join(BASE_DIR, "..", ".env"),
    os.path.join(BASE_DIR, "..", "backend", ".env"),
]:
    if os.path.isfile(env_candidate):
        load_dotenv(env_candidate)
        break

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("DIRECT_URL")
PNCP_BASE_URL = os.getenv("PNCP_BASE_URL", "https://pncp.gov.br/api/consulta/v1").rstrip("/")
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "sync_pncp.log")

# ---------------------------------------------------------------------------
# SISTEMA DE LOGGING PROFISSIONAL
# ---------------------------------------------------------------------------
logger = logging.getLogger("ExpertiseDataEngine")
logger.setLevel(logging.INFO)

if not logger.handlers:
    # Handler de arquivo rotativo (máximo 10MB por arquivo, até 5 backups)
    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_format = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(process)d] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_format)
    logger.addHandler(file_handler)

    # Handler de console
    console_handler = logging.StreamHandler(sys.stdout)
    console_format = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

# ---------------------------------------------------------------------------
# SESSÃO HTTP RESILIENTE COM RETRIES EXPONENCIAIS
# ---------------------------------------------------------------------------
def create_resilient_session(
    retries: int = 5,
    backoff_factor: float = 1.5,
    status_forcelist: Tuple[int, ...] = (429, 500, 502, 503, 504),
) -> requests.Session:
    """Cria uma sessão requests com retries automáticos e backoff exponencial."""
    session = requests.Session()
    retry_strategy = Retry(
        total=retries,
        read=retries,
        connect=retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=10, pool_maxsize=10)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({
        "User-Agent": "ExpertiseLicitatoria-DataEngine/2.0 (B2B Public Procurement Automation)",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
    })
    return session

# ---------------------------------------------------------------------------
# PARSERS E NORMALIZAÇÃO DE DADOS
# ---------------------------------------------------------------------------
def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Converte strings ISO-8601 da API do PNCP para objeto datetime com timezone de Brasília (-03:00)."""
    if not dt_str:
        return None
    str_val = str(dt_str).strip()
    if not str_val:
        return None
    try:
        # Se tiver apenas 10 caracteres (YYYY-MM-DD), anexa T12:00:00-03:00
        if len(str_val) == 10 and str_val.count("-") == 2:
            return datetime.fromisoformat(f"{str_val}T12:00:00-03:00")

        # Se já terminar com Z
        if str_val.endswith("Z"):
            return datetime.fromisoformat(str_val[:-1] + "+00:00")

        # Se a string ISO não tiver timezone (Z ou +/-HH:MM), anexa -03:00 antes de fromisoformat
        if not ("+" in str_val[10:] or "-" in str_val[10:]):
            return datetime.fromisoformat(f"{str_val}-03:00")

        return datetime.fromisoformat(str_val)
    except Exception:
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(str_val[:19], fmt)
                return dt.replace(tzinfo=timezone(timedelta(hours=-3)))
            except Exception:
                pass
    return None

def clean_cnpj(doc: Optional[str]) -> Optional[str]:
    """Remove caracteres não numéricos de CNPJ/CPF."""
    if not doc:
        return None
    cleaned = "".join(filter(str.isdigit, str(doc)))
    return cleaned if cleaned else None

# ---------------------------------------------------------------------------
# MOTOR DE BANCO DE DADOS (POSTGRESQL / NEON)
# ---------------------------------------------------------------------------
class DatabaseEngine:
    """Gerencia conexão e operações de UPSERT com segurança transacional."""

    def __init__(self, connection_url: str):
        if not connection_url:
            raise ValueError(
                "DATABASE_URL não configurada. Defina no arquivo .env ou como variável de ambiente."
            )
        self.connection_url = connection_url
        self.conn: Optional[psycopg2.extensions.connection] = None

    def connect(self):
        """Estabelece conexão com o PostgreSQL com validação de SSL."""
        try:
            self.conn = psycopg2.connect(
                self.connection_url,
                connect_timeout=15,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
            )
            self.conn.autocommit = False
            self.ensure_schema()
            logger.info("Conexão com PostgreSQL (Neon) estabelecida com sucesso.")
        except Exception as e:
            logger.critical(f"Falha ao conectar no banco de dados: {e}")
            raise

    def ensure_schema(self):
        """Garante que a coluna e o constraint UNIQUE numero_controle_pncp existam."""
        query = """
        DO $$
        BEGIN
            -- 1. Garante coluna numero_controle_pncp
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'procurement_notices' AND column_name = 'numero_controle_pncp'
            ) THEN
                ALTER TABLE procurement_notices ADD COLUMN numero_controle_pncp TEXT;
            END IF;

            -- 2. Garante constraint UNIQUE
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'procurement_notices_numero_controle_pncp_unique'
            ) THEN
                ALTER TABLE procurement_notices 
                ADD CONSTRAINT procurement_notices_numero_controle_pncp_unique UNIQUE (numero_controle_pncp);
            END IF;
        END $$;
        """
        with self.conn.cursor() as cur:
            cur.execute(query)
        self.conn.commit()

    def upsert_batch(self, notices: List[Dict[str, Any]]) -> Tuple[int, int]:
        """
        Executa UPSERT atômico em lote usando ON CONFLICT (numero_controle_pncp).
        Retorna: (total_inseridos, total_atualizados)
        """
        if not notices:
            return (0, 0)

        upsert_sql = """
        INSERT INTO procurement_notices (
            source,
            external_id,
            numero_controle_pncp,
            dedupe_key,
            content_hash,
            notice_number,
            processo_administrativo,
            modality,
            buyer_name,
            buyer_document,
            object,
            uf,
            municipality,
            estimated_value,
            status,
            url,
            published_at,
            opening_at,
            closing_at,
            srp,
            modo_disputa,
            amparo_legal,
            raw_payload,
            created_at,
            updated_at,
            exclusive_me_epp
        ) VALUES (
            %(source)s,
            %(external_id)s,
            %(numero_controle_pncp)s,
            %(dedupe_key)s,
            %(content_hash)s,
            %(notice_number)s,
            %(processo_administrativo)s,
            %(modality)s,
            %(buyer_name)s,
            %(buyer_document)s,
            %(object)s,
            %(uf)s,
            %(municipality)s,
            %(estimated_value)s,
            %(status)s,
            %(url)s,
            %(published_at)s,
            %(opening_at)s,
            %(closing_at)s,
            %(srp)s,
            %(modo_disputa)s,
            %(amparo_legal)s,
            %(raw_payload)s,
            NOW(),
            NOW(),
            %(exclusive_me_epp)s
        )
        ON CONFLICT (numero_controle_pncp) DO UPDATE SET
            notice_number = EXCLUDED.notice_number,
            processo_administrativo = EXCLUDED.processo_administrativo,
            modality = EXCLUDED.modality,
            buyer_name = EXCLUDED.buyer_name,
            buyer_document = EXCLUDED.buyer_document,
            object = EXCLUDED.object,
            uf = EXCLUDED.uf,
            municipality = EXCLUDED.municipality,
            estimated_value = EXCLUDED.estimated_value,
            status = EXCLUDED.status,
            url = COALESCE(EXCLUDED.url, procurement_notices.url),
            published_at = EXCLUDED.published_at,
            opening_at = EXCLUDED.opening_at,
            closing_at = EXCLUDED.closing_at,
            srp = EXCLUDED.srp,
            modo_disputa = EXCLUDED.modo_disputa,
            amparo_legal = EXCLUDED.amparo_legal,
            raw_payload = EXCLUDED.raw_payload,
            content_hash = EXCLUDED.content_hash,
            updated_at = NOW()
        RETURNING (xmax = 0) AS is_insert;
        """

        inserted = 0
        updated = 0

        try:
            with self.conn.cursor() as cur:
                for item in notices:
                    cur.execute(upsert_sql, item)
                    res = cur.fetchone()
                    if res and res[0]:
                        inserted += 1
                    else:
                        updated += 1
            self.conn.commit()
            return (inserted, updated)
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Erro na transação de UPSERT: {e}")
            raise

    def close(self):
        """Fecha a conexão com segurança."""
        if self.conn and not self.conn.closed:
            self.conn.close()
            logger.info("Conexão com PostgreSQL finalizada.")

# ---------------------------------------------------------------------------
# INGESTÃO DA API PNCP
# ---------------------------------------------------------------------------
class PncpIngestionService:
    """Motor de coleta da API oficial de publicação do PNCP."""

    # Modalidades padrão da Lei 14.133/2021:
    # 6 = Pregão Eletrônico | 8 = Dispensa de Licitação | 4 = Concorrência Eletrônica | 12 = Credenciamento
    DEFAULT_MODALIDADES = [6, 8, 4, 12]

    def __init__(self, session: requests.Session, db_engine: DatabaseEngine):
        self.session = session
        self.db = db_engine

    def fetch_page(
        self,
        data_inicial: str,
        data_final: str,
        modalidade: int,
        pagina: int = 1,
        tamanho_pagina: int = 20,
        uf: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Executa a requisição HTTP para a rota oficial de contratações do PNCP."""
        url = f"{PNCP_BASE_URL}/contratacoes/publicacao"
        params: Dict[str, Any] = {
            "dataInicial": data_inicial,
            "dataFinal": data_final,
            "codigoModalidadeContratacao": modalidade,
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if uf:
            params["uf"] = uf.upper()

        resp = self.session.get(url, params=params, timeout=30)

        # 204 No Content indica que não há editais para os filtros/período
        if resp.status_code == 204:
            return {"data": [], "totalRegistros": 0, "totalPaginas": 0}

        # Trata erros específicos de infraestrutura do governo
        if resp.status_code in (502, 503, 504):
            logger.warning(
                f"PNCP indisponível (HTTP {resp.status_code}) para modalidade {modalidade}, pág {pagina}. Aguardando retentativa..."
            )
            resp.raise_for_status()

        if resp.status_code != 200:
            error_body = resp.text[:250]
            logger.error(f"Erro na API do PNCP HTTP {resp.status_code}: {error_body}")
            resp.raise_for_status()

        return resp.json()

    def transform_item(self, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Transforma e valida o payload da API para os campos da tabela procurement_notices."""
        num_pncp = (raw.get("numeroControlePNCP") or "").strip()
        if not num_pncp:
            return None

        orgao = raw.get("orgaoEntidade") or {}
        unidade = raw.get("unidadeOrgao") or {}

        # 1. Órgão Licitante e Documento
        buyer_name = (
            orgao.get("razaoSocial")
            or unidade.get("nomeUnidade")
            or "Órgão Licitante Governamental"
        )
        buyer_doc = clean_cnpj(orgao.get("cnpj"))

        # 2. Objeto do Edital (Truncamento preventivo de segurança para textos gigantes)
        object_text = (
            raw.get("objetoCompra")
            or raw.get("objeto")
            or "Objeto não detalhado pelo órgão no aviso do PNCP"
        ).strip()

        # 3. Valor Estimado: se estimated_value <= 0, grava None (NULL no PostgreSQL)
        raw_val = raw.get("valorTotalEstimado")
        try:
            val_float = float(raw_val) if raw_val is not None and str(raw_val).strip() else None
            estimated_value = val_float if val_float is not None and val_float > 0 else None
        except (ValueError, TypeError):
            estimated_value = None

        # 4. Modalidade
        modality_name = raw.get("modalidadeNome") or "Pregão Eletrônico"

        # 5. Identificadores e Links
        notice_num = raw.get("numeroCompra") or raw.get("processo") or num_pncp
        url_link = (
            raw.get("linkEditalPNCP")
            or raw.get("linkSistemaOrigem")
            or f"https://pncp.gov.br/app/editais/{num_pncp}"
        )

        # 6. Hash de Integridade
        content_hash = hashlib.sha256(
            f"{num_pncp}|{object_text}|{estimated_value}".encode("utf-8")
        ).hexdigest()

        return {
            "source": "pncp",
            "external_id": num_pncp,
            "numero_controle_pncp": num_pncp,
            "dedupe_key": f"pncp-{num_pncp}",
            "content_hash": content_hash,
            "notice_number": str(notice_num)[:100],
            "processo_administrativo": raw.get("processo"),
            "modality": str(modality_name)[:100],
            "buyer_name": str(buyer_name)[:255],
            "buyer_document": buyer_doc,
            "object": object_text,
            "uf": (unidade.get("ufSigla") or "")[:2] or None,
            "municipality": unidade.get("municipioNome"),
            "estimated_value": estimated_value,
            "status": raw.get("situacaoCompraNome") or "Divulgada no PNCP",
            "url": str(url_link)[:1000] if url_link else None,
            "published_at": parse_iso_datetime(raw.get("dataPublicacaoPncp")),
            "opening_at": parse_iso_datetime(raw.get("dataAberturaProposta")),
            "closing_at": parse_iso_datetime(raw.get("dataEncerramentoProposta")),
            "srp": bool(raw.get("srp", False)),
            "modo_disputa": raw.get("modoDisputaNome") or "Aberto e Fechado",
            "amparo_legal": "Lei 14.133/2021",
            "raw_payload": Json(raw),
            "exclusive_me_epp": False,
        }

    def sync(
        self,
        dias: int = 3,
        modalidades: Optional[List[int]] = None,
        max_paginas_por_modalidade: int = 20,
        tamanho_pagina: int = 20,
        uf: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executa o ciclo completo de sincronização para o período especificado.
        """
        hoje = datetime.now()
        data_inicial = (hoje - timedelta(days=dias)).strftime("%Y%m%d")
        data_final = hoje.strftime("%Y%m%d")

        mods = modalidades or self.DEFAULT_MODALIDADES
        stats = {
            "periodo": f"{data_inicial} até {data_final}",
            "total_coletados": 0,
            "total_inseridos": 0,
            "total_atualizados": 0,
            "paginas_processadas": 0,
            "erros": 0,
        }

        logger.info(
            f"Iniciando ciclo de ingestão PNCP | Período: {data_inicial} a {data_final} | "
            f"Modalidades: {mods} | Max Páginas: {max_paginas_por_modalidade}"
        )

        for mod in mods:
            logger.info(f"--- Processando Modalidade PNCP ID: {mod} ---")
            pagina = 1

            while pagina <= max_paginas_por_modalidade:
                try:
                    payload = self.fetch_page(
                        data_inicial=data_inicial,
                        data_final=data_final,
                        modalidade=mod,
                        pagina=pagina,
                        tamanho_pagina=tamanho_pagina,
                        uf=uf,
                    )
                    items_raw = payload.get("data") or []
                    total_paginas = payload.get("totalPaginas") or 1
                    total_registros = payload.get("totalRegistros") or 0

                    if not items_raw:
                        logger.info(f"Modalidade {mod}: Sem mais registros na página {pagina}.")
                        break

                    transformed: List[Dict[str, Any]] = []
                    for raw in items_raw:
                        t = self.transform_item(raw)
                        if t:
                            transformed.append(t)

                    # Persiste no Neon PostgreSQL
                    inserted, updated = self.db.upsert_batch(transformed)

                    stats["total_coletados"] += len(transformed)
                    stats["total_inseridos"] += inserted
                    stats["total_atualizados"] += updated
                    stats["paginas_processadas"] += 1

                    logger.info(
                        f"[Mod {mod}] Pág {pagina}/{total_paginas} (Total {total_registros}): "
                        f"{len(transformed)} processados (+{inserted} novos, ~{updated} atualizados)"
                    )

                    if pagina >= total_paginas:
                        break

                    pagina += 1
                    # Pequeno intervalo de cortesia para a API pública do governo
                    time.sleep(0.3)

                except requests.RequestException as req_err:
                    stats["erros"] += 1
                    logger.warning(f"Instabilidade transitória na API do PNCP (Pág {pagina}): {req_err}")
                    time.sleep(3.0)
                    pagina += 1
                except Exception as ex:
                    stats["erros"] += 1
                    logger.error(f"Erro inesperado no processamento da página {pagina}: {ex}", exc_info=True)
                    pagina += 1

        return stats

# ---------------------------------------------------------------------------
# PONTO DE ENTRADA (CLI)
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Expertise Licitatória — Motor de Ingestão de Editais PNCP (PostgreSQL Neon)"
    )
    parser.add_argument(
        "--dias",
        type=int,
        default=int(os.getenv("SYNC_DAYS", "3")),
        help="Quantidade de dias passados para sincronizar (padrão: 3 dias)",
    )
    parser.add_argument(
        "--modalidades",
        type=str,
        default=os.getenv("SYNC_MODALIDADES", "8,14,6"),
        help="IDs das modalidades separados por vírgula (padrão: 8,14,6)",
    )
    parser.add_argument(
        "--max-paginas",
        type=int,
        default=int(os.getenv("SYNC_MAX_PAGES", "20")),
        help="Número máximo de páginas por modalidade (padrão: 20)",
    )
    parser.add_argument(
        "--tamanho-pagina",
        type=int,
        default=int(os.getenv("SYNC_PAGE_SIZE", "20")),
        help="Tamanho de cada página na API PNCP (mínimo 10, padrão: 20)",
    )
    parser.add_argument(
        "--uf",
        type=str,
        default=os.getenv("SYNC_UF", None),
        help="Filtrar por UF específica (ex: SP, RJ, DF)",
    )

    args = parser.parse_args()

    # Validação do tamanho da página (regra estrita da API do PNCP: >= 10)
    if args.tamanho_pagina < 10:
        logger.warning("tamanho-pagina deve ser >= 10 conforme especificação PNCP. Ajustando para 10.")
        args.tamanho_pagina = 10

    modalidades_list = [int(m.strip()) for m in args.modalidades.split(",") if m.strip().isdigit()]

    start_time = time.time()
    logger.info("=" * 70)
    logger.info("INICIANDO MOTOR DE DADOS EXPERTISE LICITATÓRIA")
    logger.info("=" * 70)

    db = DatabaseEngine(DATABASE_URL)
    session = create_resilient_session()

    try:
        db.connect()
        service = PncpIngestionService(session=session, db_engine=db)

        stats = service.sync(
            dias=args.dias,
            modalidades=modalidades_list,
            max_paginas_por_modalidade=args.max_paginas,
            tamanho_pagina=args.tamanho_pagina,
            uf=args.uf,
        )

        elapsed = time.time() - start_time
        logger.info("=" * 70)
        logger.info("RELATÓRIO DE EXECUÇÃO EXECUTIVA")
        status = "CONCLUÍDO COM SUCESSO" if stats["erros"] == 0 else "CONCLUÍDO COM FALHAS"
        logger.info(f"Status:               {status}")
        logger.info(f"Período Sincronizado: {stats['periodo']}")
        logger.info(f"Total Capturado:      {stats['total_coletados']} editais")
        logger.info(f"Novos Inseridos:      {stats['total_inseridos']}")
        logger.info(f"Atualizados (UPSERT): {stats['total_atualizados']}")
        logger.info(f"Páginas Processadas:  {stats['paginas_processadas']}")
        logger.info(f"Falhas Transitórias:  {stats['erros']}")
        logger.info(f"Tempo de Execução:    {elapsed:.2f} segundos")
        logger.info("=" * 70)
        sys.exit(0 if stats["erros"] == 0 else 1)

    except Exception as e:
        logger.critical(f"Falha crítica na execução do Data Engine: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()
        session.close()

if __name__ == "__main__":
    main()
