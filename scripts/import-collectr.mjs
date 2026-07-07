/**
 * Import a Collectr collection export into foil-alpha for a given user.
 *
 * Reads import/collectr-mario.json (normalized export) and, for each item:
 *   1. upserts a `cards` catalog row keyed on (external_source='collectr', external_id=product_id)
 *   2. upserts a `user_cards` ownership row for the target user keyed on external_owned_id
 *
 * Idempotent: safe to re-run. Adds the required columns/indexes if missing (guarded).
 * Uses raw SQL so it works without regenerating the Prisma client for the new columns.
 *
 * Usage:
 *   node scripts/import-collectr.mjs --db="mysql://..." --email="mario@example.com" [--create] [--name="mario"] [--file=import/collectr-mario.json] [--dry]
 *   (or set DATABASE_URL in the environment instead of --db)
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

// ---- args ----
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/s);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const DB = args.db || process.env.DATABASE_URL;
const EMAIL = args.email;
const NAME = args.name || 'mario';
const CREATE = args.create === true || args.create === 'true';
const FILE = args.file || 'import/collectr-mario.json';
const DRY = args.dry === true || args.dry === 'true';

if (!DB) { console.error('❌ Missing DATABASE_URL: pass --db="mysql://..." or set env DATABASE_URL'); process.exit(1); }
if (!EMAIL) { console.error('❌ Missing target user: pass --email="mario@example.com"'); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
const items = JSON.parse(readFileSync(FILE, 'utf8'));
console.log(`📄 Loaded ${items.length} items from ${FILE}${DRY ? '  (DRY RUN — no writes)' : ''}`);

// ---- schema setup (idempotent; MySQL has no ADD COLUMN IF NOT EXISTS) ----
async function ensureSchema() {
  const colNames = async (table) =>
    (await prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, table
    )).map((r) => r.c);
  const idxNames = async (table) =>
    (await prisma.$queryRawUnsafe(`SHOW INDEX FROM \`${table}\``)).map((r) => r.Key_name);

  const cards = await colNames('cards');
  const uc = await colNames('user_cards');
  const ddl = [];
  const need = (have, table, col, def) => { if (!have.includes(col)) ddl.push(`ALTER TABLE \`${table}\` ADD COLUMN ${def}`); };

  need(cards, 'cards', 'product_type', "`product_type` VARCHAR(20) NOT NULL DEFAULT 'CARD'");
  need(cards, 'cards', 'tcg', '`tcg` VARCHAR(50) NULL');
  need(cards, 'cards', 'external_source', '`external_source` VARCHAR(30) NULL');
  need(cards, 'cards', 'external_id', '`external_id` VARCHAR(100) NULL');
  need(uc, 'user_cards', 'quantity', '`quantity` INT NOT NULL DEFAULT 1');
  need(uc, 'user_cards', 'is_graded', '`is_graded` TINYINT(1) NOT NULL DEFAULT 0');
  need(uc, 'user_cards', 'grade_label', '`grade_label` VARCHAR(50) NULL');
  need(uc, 'user_cards', 'acquired_market_price', '`acquired_market_price` DECIMAL(10,2) NULL');
  need(uc, 'user_cards', 'external_owned_id', '`external_owned_id` VARCHAR(100) NULL');

  // Schema changes are pre-approved, additive, and idempotent, so they are applied
  // even under --dry (otherwise the data-preview upserts can't reference the columns).
  if (ddl.length && DRY) console.log('  (applying approved additive schema changes even in --dry so the preview is accurate)');
  for (const sql of ddl) { console.log('  🔧', sql); await prisma.$executeRawUnsafe(sql); }

  const cIdx = await idxNames('cards');
  if (!cIdx.includes('uniq_cards_external'))
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX `uniq_cards_external` ON `cards`(`external_source`,`external_id`)').catch((e) => console.warn('  idx uniq_cards_external skipped:', e.message));
  const uIdx = await idxNames('user_cards');
  if (!uIdx.includes('uniq_uc_external_owned'))
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX `uniq_uc_external_owned` ON `user_cards`(`external_owned_id`)').catch((e) => console.warn('  idx uniq_uc_external_owned skipped:', e.message));
  console.log(`  ✅ schema ready (${ddl.length} column(s) added)`);
}

// ---- user ----
async function resolveUser() {
  const rows = await prisma.$queryRawUnsafe('SELECT id, email, name FROM users WHERE email = ?', EMAIL);
  if (rows.length) { console.log(`👤 user: ${rows[0].email} (id ${rows[0].id})`); return Number(rows[0].id); }
  if (!CREATE) throw new Error(`User ${EMAIL} not found. Create it via app signup, or re-run with --create.`);
  if (DRY) { console.log(`👤 would create user ${EMAIL}`); return -1; }
  // Placeholder credential — user must reset password to log in.
  await prisma.$executeRawUnsafe(
    'INSERT INTO users (email, name, password, role, is_verified, registeredAt) VALUES (?,?,?,?,?,NOW())',
    EMAIL, NAME, '!imported-no-login-' + Date.now(), 'user', 1
  );
  const created = await prisma.$queryRawUnsafe('SELECT id FROM users WHERE email = ?', EMAIL);
  console.log(`👤 created user ${EMAIL} (id ${created[0].id}) — set a password via reset to enable login`);
  return Number(created[0].id);
}

// ---- upserts ----
async function upsertCard(it) {
  const type = it.item_type === 'sealed' ? 'SEALED' : 'CARD';
  const found = await prisma.$queryRawUnsafe(
    "SELECT id FROM cards WHERE external_source = 'collectr' AND external_id = ?", String(it.collectr_product_id)
  );
  if (found.length) {
    if (!DRY) await prisma.$executeRawUnsafe(
      'UPDATE cards SET name=?, set_name=?, set_id=?, card_number=?, rarity=?, image_url=?, market_price=?, product_type=?, tcg=?, updated_at=NOW() WHERE id=?',
      it.name, it.set_name, String(it.set_id), it.card_number || '', it.rarity || '', it.image_url || null, it.market_price ?? null, type, it.tcg || null, Number(found[0].id)
    );
    return { id: Number(found[0].id), created: false };
  }
  const ptid = `collectr-${it.collectr_product_id}`;
  if (!DRY) await prisma.$executeRawUnsafe(
    `INSERT INTO cards
       (price_tracker_id, name, card_number, rarity, set_id, set_name, image_url, market_price,
        product_type, tcg, external_source, external_id, source, sync_enabled, sync_errors, last_updated, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, 'collectr', ?, 'MANUAL', 0, 0, NOW(), NOW(), NOW())`,
    ptid, it.name, it.card_number || '', it.rarity || '', String(it.set_id), it.set_name,
    it.image_url || null, it.market_price ?? null, type, it.tcg || null, String(it.collectr_product_id)
  );
  const row = DRY ? [{ id: -1 }] : await prisma.$queryRawUnsafe('SELECT id FROM cards WHERE price_tracker_id = ?', ptid);
  return { id: Number(row[0].id), created: true };
}

async function upsertOwned(it, cardId, ownerId) {
  const graded = it.is_graded ? 1 : 0;
  const gradeLabel = it.is_graded ? `Collectr#${it.grade_code}` : null;
  const found = await prisma.$queryRawUnsafe('SELECT id FROM user_cards WHERE external_owned_id = ?', String(it.collectr_owned_id));
  if (found.length) {
    if (!DRY) await prisma.$executeRawUnsafe(
      'UPDATE user_cards SET owner_id=?, card_id=?, `condition`=?, quantity=?, is_graded=?, grade_label=?, acquired_market_price=? WHERE id=?',
      ownerId, cardId, it.condition || 'NM', it.quantity || 1, graded, gradeLabel, it.market_price ?? null, Number(found[0].id)
    );
    return 'updated';
  }
  if (!DRY) await prisma.$executeRawUnsafe(
    `INSERT INTO user_cards
       (owner_id, card_id, \`condition\`, quantity, is_graded, grade_label, acquired_market_price, external_owned_id, acquired_date, created_at)
     VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())`,
    ownerId, cardId, it.condition || 'NM', it.quantity || 1, graded, gradeLabel, it.market_price ?? null, String(it.collectr_owned_id)
  );
  return 'created';
}

async function main() {
  await prisma.$queryRawUnsafe('SELECT 1');
  console.log('🔌 connected');
  await ensureSchema();
  const ownerId = await resolveUser();

  const stat = { cardsCreated: 0, cardsUpdated: 0, ownedCreated: 0, ownedUpdated: 0, units: 0, value: 0, errors: 0 };
  let n = 0;
  for (const it of items) {
    try {
      const card = await upsertCard(it);
      card.created ? stat.cardsCreated++ : stat.cardsUpdated++;
      const res = await upsertOwned(it, card.id, ownerId);
      res === 'created' ? stat.ownedCreated++ : stat.ownedUpdated++;
      stat.units += it.quantity || 1;
      stat.value += (it.market_price || 0) * (it.quantity || 1);
    } catch (e) {
      stat.errors++;
      console.warn(`  ⚠️  ${it.name} (${it.collectr_owned_id}): ${e.message}`);
    }
    if (++n % 50 === 0) console.log(`  …${n}/${items.length}`);
  }

  console.log('\n===== SUMMARY =====');
  console.log(`cards:      ${stat.cardsCreated} created, ${stat.cardsUpdated} updated`);
  console.log(`user_cards: ${stat.ownedCreated} created, ${stat.ownedUpdated} updated  (${stat.units} units)`);
  console.log(`value:      $${stat.value.toFixed(2)}`);
  console.log(`errors:     ${stat.errors}`);
  if (DRY) console.log('(DRY RUN — nothing was written)');
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
