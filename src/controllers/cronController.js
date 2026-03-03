const bggSyncService = require('../services/bggSyncService');
const config = require('../../config');

function parseBoolean(value) {
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    return false;
}

function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') return '';
    const [scheme, token] = authHeader.split(' ');
    if (!scheme || !token) return '';
    if (scheme.toLowerCase() !== 'bearer') return '';
    return token.trim();
}

class CronController {
    async syncBgg(req, res) {
        const cronSecret = config.cron.secret;
        const bearerToken = extractBearerToken(req.headers.authorization);
        const providedSecret = req.headers['x-cron-secret'] || bearerToken || req.query.secret || req.body?.secret;

        if (cronSecret && providedSecret !== cronSecret) {
            return res.status(403).json({
                success: false,
                error: 'forbidden'
            });
        }

        const isVercelCron = Boolean(req.headers['x-vercel-cron']);
        const jobType = req.query.jobType || req.body?.jobType || (isVercelCron ? 'full' : 'incremental');
        const limitRaw = req.query.limit || req.body?.limit;
        const force = parseBoolean(req.query.force || req.body?.force);
        const requestedBy = isVercelCron ? 'vercel-cron' : 'api';

        try {
            const result = await bggSyncService.runDetailSync({
                jobType: force ? 'full' : jobType,
                limit: limitRaw,
                requestedBy
            });

            return res.json({
                success: true,
                result
            });
        } catch (error) {
            console.error('BGG sync cron error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'sync failed'
            });
        }
    }
}

module.exports = new CronController();
