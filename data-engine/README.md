# EXPERTISE LICITATÓRIA — DATA ENGINE (INGESTÃO CONTÍNUA PNCP)

Motor de ingestão de dados resiliente, autônomo e de alta performance desenvolvido em Python para alimentar o banco de dados PostgreSQL (Neon) com editais públicos reais do **Portal Nacional de Contratações Públicas (PNCP)**, em estrita conformidade com a **Lei 14.133/2021**.

O sistema opera de forma desacoplada do backend Node.js, garantindo:
- **Zero Sobrecarga no Servidor Web:** O backend e o frontend consultam exclusivamente o banco PostgreSQL interno, garantindo tempo de resposta sub-segundo para o usuário final.
- **Idempotência Absoluta:** O motor executa `UPSERT` nativo na tabela `procurement_notices` usando o campo oficial `numero_controle_pncp` como chave única.
- **Resiliência a Falhas do Governo:** Retentativas exponenciais automáticas para instabilidades da API pública (HTTP 429, 500, 502, 503, 504) e timeouts.

---

## 1. REQUISITOS E INSTALAÇÃO

### Pré-requisitos
- Python 3.10 ou superior
- Acesso ao banco de dados PostgreSQL (Neon)

### Instalação Rápida das Dependências
Na pasta `data-engine/`, instale as bibliotecas necessárias:

```bash
cd data-engine
pip install -r requirements.txt
```

*(Dependências utilizadas: `psycopg2-binary`, `requests`, `python-dotenv`, `urllib3`)*

---

## 2. CONFIGURAÇÃO DE AMBIENTE (.env)

O script detecta automaticamente o arquivo `.env` localizado no próprio diretório `data-engine/`, na raiz do projeto ou em `backend/.env`.

Caso deseje configurar individualmente, copie o arquivo de exemplo:
```bash
copy .env.example .env
```

Principais parâmetros:
| Variável | Descrição | Padrão |
| :--- | :--- | :--- |
| `DATABASE_URL` | String de conexão PostgreSQL (Neon) com SSL | Herdada de `backend/.env` |
| `PNCP_BASE_URL` | Endpoint oficial da API do PNCP | `https://pncp.gov.br/api/consulta/v1` |
| `SYNC_DAYS` | Quantidade de dias retroativos por execução | `3` |
| `SYNC_MODALIDADES` | Modalidades da Lei 14.133 (8=Pregão, 14=Dispensa, 6=Concorrência) | `8,14,6` |
| `SYNC_MAX_PAGES` | Limite de páginas por modalidade a cada ciclo | `20` |
| `SYNC_PAGE_SIZE` | Itens por página na API (mínimo 10) | `20` |
| `SYNC_UF` | Filtro por UF específico (opcional) | Vazio (Brasil inteiro) |

---

## 3. EXECUÇÃO MANUAL E TESTES

Para testar a ingestão imediatamente:

```bash
# Execução padrão (últimos 3 dias, modalidades 8, 14 e 6)
python sync_pncp.py

# Execução customizada (apenas último dia, 2 páginas por modalidade para teste rápido)
python sync_pncp.py --dias 1 --max-paginas 2

# Filtrar apenas por um estado específico (ex: São Paulo)
python sync_pncp.py --uf SP --dias 2
```

---

## 4. AGENDAMENTO AUTÔNOMO NO WINDOWS (TASK SCHEDULER)

Para que o motor de dados trabalhe 24 horas por dia de forma invisível no Windows, configure uma tarefa agendada:

### Opção A: Configuração via PowerShell (Recomendado — 1 Linha)
Abra o **PowerShell como Administrador** e execute o comando abaixo (ajuste o caminho do projeto se necessário):

```powershell
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument '/c "c:\Users\Raynara Kácia\Documents\Projetos\Expertise-licitatoria\EXPERTISE\data-engine\run_sync.bat"'
$trigger = New-ScheduledTaskTrigger -Daily -At 06:00
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "Expertise_PNCP_Sync" -Action $action -Trigger $trigger -Settings $settings -Description "Sincronização Contínua de Editais PNCP - Expertise Licitatória"
```

> **Para rodar a cada 2 horas:**
```powershell
$trigger = New-ScheduledTaskTrigger -Once -At 00:00 -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
Set-ScheduledTask -TaskName "Expertise_PNCP_Sync" -Trigger $trigger
```

### Opção B: Configuração Gráfica (Interface do Windows)
1. Pressione `Win + R`, digite `taskschd.msc` e pressione Enter.
2. No menu lateral, clique em **Criar Tarefa Básica**.
3. **Nome:** `Expertise Licitatória - Ingestão PNCP`.
4. **Disparador:** Diariamente às `06:00` (ou repetir a cada 2 horas).
5. **Ação:** Iniciar um programa.
6. **Programa/script:** `c:\Users\Raynara Kácia\Documents\Projetos\Expertise-licitatoria\EXPERTISE\data-engine\run_sync.bat`.
7. Conclua a criação. A tarefa rodará em segundo plano sem necessidade de intervenção humana.

---

## 5. AGENDAMENTO EM SERVIDORES LINUX / VPS (CRONTAB)

Em ambientes de produção (Ubuntu, Debian, AWS EC2, DigitalOcean):

1. Abra o crontab do servidor:
   ```bash
   crontab -e
   ```

2. Adicione a linha para rodar de 2 em 2 horas ou diariamente às 06:00:
   ```cron
   # Sincronização PNCP a cada 2 horas
   0 */2 * * * cd /var/www/expertise/data-engine && /usr/bin/python3 sync_pncp.py >> logs/cron.log 2>&1

   # Ou diariamente às 06:00 da manhã
   0 6 * * * cd /var/www/expertise/data-engine && /usr/bin/python3 sync_pncp.py >> logs/cron.log 2>&1
   ```

---

## 6. LOGS E MONITORAMENTO

Todas as execuções gravam registros detalhados em:
- Arquivo de log rotativo: `data-engine/logs/sync_pncp.log` (limite de 10MB por arquivo, com rotação automática de 5 backups).
- Saída padrão do console (stdout).

### Exemplo de Log Produzido:
```text
[2026-10-20 07:56:23] [INFO] ======================================================================
[2026-10-20 07:56:23] [INFO] INICIANDO MOTOR DE DADOS EXPERTISE LICITATÓRIA
[2026-10-20 07:56:25] [INFO] Conexão com PostgreSQL (Neon) estabelecida com sucesso.
[2026-10-20 07:56:28] [INFO] [Mod 8] Pág 1/136: 20 processados (+20 novos, ~0 atualizados)
[2026-10-20 07:56:37] [INFO] RELATÓRIO DE EXECUÇÃO EXECUTIVA
[2026-10-20 07:56:37] [INFO] Status:               CONCLUÍDO COM SUCESSO
[2026-10-20 07:56:37] [INFO] Total Capturado:      81 editais
[2026-10-20 07:56:37] [INFO] Novos Inseridos:      81
[2026-10-20 07:56:37] [INFO] Atualizados (UPSERT): 0
[2026-10-20 07:56:37] [INFO] Tempo de Execução:    14.14 segundos
[2026-10-20 07:56:37] [INFO] ======================================================================
```
