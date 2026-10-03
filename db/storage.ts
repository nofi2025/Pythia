import type { Assessment } from '../lib/model';

/** Atomic snapshot save. The unique audit ID gates every dependent write after CAS. */
export async function saveAssessment(database: D1Database, a: Assessment, owner: string) {
  const revision = a.revision + 1;
  const updated = new Date().toISOString();
  const operation = crypto.randomUUID();
  const body = JSON.stringify({ ...a, revision });
  const first = a.revision === 0
    ? database.prepare('INSERT INTO assessments(id,owner,name,body,revision,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
      .bind(a.id, owner, a.company.name, body, revision, updated)
    : database.prepare('UPDATE assessments SET name=?,body=?,revision=?,updated=? WHERE id=? AND owner=? AND revision=?')
      .bind(a.company.name, body, revision, updated, a.id, owner, a.revision);
  const gate = 'EXISTS(SELECT 1 FROM audit WHERE id=? AND assessment=? AND actor=?)';
  const statements = [
    first,
    database.prepare('INSERT INTO audit(id,assessment,actor,action,created) SELECT ?,?,?,?,? WHERE changes()=1')
      .bind(operation, a.id, owner, `Saved revision ${revision}; approved scenarios: ${a.scenarios.filter(s => s.approved).map(s => s.id).join(', ')}`, updated),
    database.prepare(`DELETE FROM edges WHERE assessment=? AND ${gate}`).bind(a.id, operation, a.id, owner),
    database.prepare(`DELETE FROM nodes WHERE assessment=? AND ${gate}`).bind(a.id, operation, a.id, owner),
    database.prepare(`INSERT INTO nodes(assessment,revision,id,label,kind) SELECT ?,?,json_extract(value,'$.id'),json_extract(value,'$.label'),json_extract(value,'$.kind') FROM json_each(?) WHERE ${gate}`)
      .bind(a.id, revision, JSON.stringify(a.nodes), operation, a.id, owner),
    database.prepare(`INSERT INTO edges(assessment,revision,id,source,target,critical,alternative) SELECT ?,?,json_extract(value,'$.id'),json_extract(value,'$.source'),json_extract(value,'$.target'),json_extract(value,'$.critical'),json_extract(value,'$.alternative') FROM json_each(?) WHERE ${gate}`)
      .bind(a.id, revision, JSON.stringify(a.edges), operation, a.id, owner),
  ];
  const results = await database.batch(statements);
  return results[0].meta.changes ? { revision, updated } : null;
}

export async function getAssessment(database: D1Database, id: string, owner: string) {
  const row = await database.prepare('SELECT body,revision FROM assessments WHERE id=? AND owner=?')
    .bind(id, owner).first<{body: string, revision: number}>();
  return row ? { ...JSON.parse(row.body), revision: row.revision } : null;
}

export async function listAssessments(database: D1Database, owner: string) {
  const rows = await database.prepare('SELECT id,name,revision,updated FROM assessments WHERE owner=? ORDER BY updated DESC')
    .bind(owner).all();
  return rows.results;
}
