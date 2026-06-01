const bggSyncService = require('../services/bggSyncService');
const bggDiscoveryService = require('../services/bggDiscoveryService');
const config = require('../../config');
const {
    isCronAuthorized,
    normalizeJobType,
    normalizeLimit
} = require('../utils/cronAuth');

function parseBoolean(value) {
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    return false;
}

class CronController {
    async syncBgg(req, res) {
        const cronSecret = config.cron.secret;
        if (!cronSecret) {
            return res.status(503).json({
                success: false,
                error: 'cron secret is not configured'
            });
        }

        if (!isCronAuthorized(req.headers, cronSecret)) {
            return res.status(403).json({
                success: false,
                error: 'forbidden'
            });
        }

        const isVercelCron = Boolean(req.headers['x-vercel-cron']);
        const jobType = normalizeJobType(req.query.jobType || req.body?.jobType || (isVercelCron ? 'full' : 'incremental'));
        const limit = normalizeLimit(req.query.limit || req.body?.limit, config.cron.maxSyncLimit);
        const dumpLimit = normalizeLimit(req.query.dumpLimit || req.body?.dumpLimit, config.cron.maxDumpLimit);
        const force = parseBoolean(req.query.force || req.body?.force);
        const shouldDiscover = req.query.discover !== undefined || req.body?.discover !== undefined
            ? parseBoolean(req.query.discover || req.body?.discover)
            : isVercelCron;
        const shouldSyncDetails = req.query.detail !== undefined || req.body?.detail !== undefined
            ? parseBoolean(req.query.detail || req.body?.detail)
            : true;
        const requestedBy = isVercelCron ? 'vercel-cron' : 'api';

        try {
            const discovery = shouldDiscover
                ? await bggDiscoveryService.runDumpSync({
                    limit: dumpLimit,
                    requestedBy
                })
                : null;
            const detail = shouldSyncDetails
                ? await bggSyncService.runDetailSync({
                    jobType: force ? 'full' : jobType,
                    limit,
                    requestedBy
                })
                : null;

            return res.json({
                success: true,
                result: {
                    discovery,
                    detail
                }
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
