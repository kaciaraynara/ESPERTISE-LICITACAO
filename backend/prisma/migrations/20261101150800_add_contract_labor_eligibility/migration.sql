ALTER TABLE "contracts"
  ADD COLUMN "dedicacao_exclusiva" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "predominancia_mao_de_obra" BOOLEAN NOT NULL DEFAULT false;
