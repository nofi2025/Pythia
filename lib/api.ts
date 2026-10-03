import { assessmentSchema } from './model';
import { getAssessment, listAssessments, saveAssessment } from '../db/storage';
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function assessmentHandlers(db:()=>D1Database, getChatGPTUser:()=>Promise<{userId:string}|null>) {
async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return response({ error: 'Sign in to access assessments.' }, 401);
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const result = await getAssessment(db(), id, user.userId);
      return result ? response(result) : response({ error: 'Assessment not found' }, 404);
    }
    return response(await listAssessments(db(), user.userId));
  } catch (error) {
    console.error('Assessment read failed', error);
    return response({ error: 'Storage unavailable. Please try again.' }, 503);
  }
}
async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return response({ error: 'Sign in to save assessments.' }, 401);
  if (request.headers.get('origin') !== new URL(request.url).origin) return response({ error: 'Invalid request origin' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return response({ error: 'Expected JSON' }, 415);
  try {
    const body = await request.text();
    if (body.length > 1500000) return response({ error: 'Assessment is too large.' }, 413);
    const parsed = assessmentSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return response({ error: parsed.error.issues.map(i => i.message).slice(0, 5).join('; ') }, 400);
    const result = await saveAssessment(db(), parsed.data, user.userId);
    if (!result) return response({ error: 'This assessment changed in another tab. Reload it before saving; your unsaved edits are still visible.' }, 409);
    return response(result);
  } catch (error) {
    if (error instanceof SyntaxError) return response({ error: 'Invalid assessment JSON' }, 400);
    console.error('Assessment save failed', error);
    return response({ error: 'Save failed. Your edits remain on screen. Please try again.' }, 503);
  }
}

return {GET,POST};
}
