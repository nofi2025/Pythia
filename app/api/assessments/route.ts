import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {assessmentHandlers} from '../../../lib/api';
export const dynamic='force-dynamic';
const handlers=assessmentHandlers(()=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;},getChatGPTUser);
export const GET=handlers.GET;
export const POST=handlers.POST;
