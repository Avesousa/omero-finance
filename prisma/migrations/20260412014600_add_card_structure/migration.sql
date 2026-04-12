-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "cardType" TEXT,
ADD COLUMN     "entity" TEXT,
ADD COLUMN     "ownerName" TEXT;

-- Populate structured fields from existing card names
UPDATE "Card" SET
  "cardType" = CASE
    WHEN name ~* '\bVISA\b'                                    THEN 'VISA'
    WHEN name ~* '\bMASTERCARD\b' OR name ~* '\bMC\b'         THEN 'MC'
    WHEN name ~* '\bAMEX\b' OR name ~* '\bAMERICAN EXPRESS\b' THEN 'AMEX'
    ELSE NULL
  END,
  "entity" = CASE
    WHEN name ~* '\bBBVA\b'                                      THEN 'BBVA'
    WHEN name ~* '\bBN\b' OR name ~* 'BANCO\s+NACI'             THEN 'Banco Nación'
    WHEN name ~* '\bMP\b' OR name ~* 'MERCADOPAGO'               THEN 'MercadoPago'
    WHEN name ~* '\bCP\b' OR name ~* 'CENCOPAY'                  THEN 'Cencopay'
    WHEN name ~* '\bBK\b' OR name ~* 'BRUBANK'                   THEN 'Brubank'
    WHEN name ~* 'GALICIA'                                        THEN 'Galicia'
    ELSE NULL
  END,
  "ownerName" = CASE
    WHEN name ~* '\bMARIA\b' OR name ~* '\bMAR[IÍ]A\b' THEN 'María'
    WHEN name ~* '\bAVELINO\b'                           THEN 'Avelino'
    ELSE NULL
  END;
