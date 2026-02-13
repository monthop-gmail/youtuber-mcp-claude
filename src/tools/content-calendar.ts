import Database from 'better-sqlite3';
import { z } from 'zod';
import { config } from '../config.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { log } from '../utils/logger.js';
import type { ContentPlan } from '../types/youtube.js';

let db: Database.Database | null = null;

function getDB(): Database.Database {
  if (!db) {
    const dir = dirname(config.calendar.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    db = new Database(config.calendar.dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        planned_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idea',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_plans_date ON content_plans(planned_date);
      CREATE INDEX IF NOT EXISTS idx_plans_status ON content_plans(status);
    `);
    log('info', `Content calendar DB initialized at ${config.calendar.dbPath}`);
  }
  return db;
}

const addPlanSchema = z.object({
  title: z.string().min(1),
  planned_date: z.string().min(1),
  status: z.enum(['idea', 'scripting', 'filming', 'editing', 'ready', 'published']).optional().default('idea'),
  notes: z.string().optional(),
});

const listPlansSchema = z.object({
  status_filter: z.enum(['idea', 'scripting', 'filming', 'editing', 'ready', 'published']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const updatePlanSchema = z.object({
  plan_id: z.number().int().min(1),
  title: z.string().min(1).optional(),
  planned_date: z.string().optional(),
  status: z.enum(['idea', 'scripting', 'filming', 'editing', 'ready', 'published']).optional(),
  notes: z.string().optional(),
});

const deletePlanSchema = z.object({
  plan_id: z.number().int().min(1),
});

export async function addContentPlan(args: Record<string, unknown>) {
  const params = addPlanSchema.parse(args);
  const database = getDB();
  const stmt = database.prepare(
    'INSERT INTO content_plans (title, planned_date, status, notes) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(params.title, params.planned_date, params.status, params.notes || null);
  const plan = database.prepare('SELECT * FROM content_plans WHERE id = ?').get(result.lastInsertRowid) as ContentPlan;
  return { success: true, plan };
}

export async function listContentPlans(args: Record<string, unknown>) {
  const params = listPlansSchema.parse(args);
  const database = getDB();

  let query = 'SELECT * FROM content_plans WHERE 1=1';
  const queryParams: (string | number)[] = [];

  if (params.status_filter) {
    query += ' AND status = ?';
    queryParams.push(params.status_filter);
  }
  if (params.date_from) {
    query += ' AND planned_date >= ?';
    queryParams.push(params.date_from);
  }
  if (params.date_to) {
    query += ' AND planned_date <= ?';
    queryParams.push(params.date_to);
  }

  query += ' ORDER BY planned_date ASC';
  const plans = database.prepare(query).all(...queryParams) as ContentPlan[];

  // Status summary
  const statusCounts: Record<string, number> = {};
  for (const plan of plans) {
    statusCounts[plan.status] = (statusCounts[plan.status] || 0) + 1;
  }

  return { plans, total: plans.length, statusSummary: statusCounts };
}

export async function updateContentPlan(args: Record<string, unknown>) {
  const params = updatePlanSchema.parse(args);
  const database = getDB();

  const existing = database.prepare('SELECT * FROM content_plans WHERE id = ?').get(params.plan_id) as ContentPlan | undefined;
  if (!existing) throw new Error(`Content plan not found: ${params.plan_id}`);

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (params.title !== undefined) { updates.push('title = ?'); values.push(params.title); }
  if (params.planned_date !== undefined) { updates.push('planned_date = ?'); values.push(params.planned_date); }
  if (params.status !== undefined) { updates.push('status = ?'); values.push(params.status); }
  if (params.notes !== undefined) { updates.push('notes = ?'); values.push(params.notes); }

  if (updates.length === 0) throw new Error('No fields to update');

  updates.push("updated_at = datetime('now')");
  values.push(params.plan_id);

  database.prepare(`UPDATE content_plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = database.prepare('SELECT * FROM content_plans WHERE id = ?').get(params.plan_id) as ContentPlan;
  return { success: true, plan: updated };
}

export async function deleteContentPlan(args: Record<string, unknown>) {
  const params = deletePlanSchema.parse(args);
  const database = getDB();

  const existing = database.prepare('SELECT * FROM content_plans WHERE id = ?').get(params.plan_id) as ContentPlan | undefined;
  if (!existing) throw new Error(`Content plan not found: ${params.plan_id}`);

  database.prepare('DELETE FROM content_plans WHERE id = ?').run(params.plan_id);
  return { success: true, deletedPlan: existing };
}

export function closeCalendarDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
