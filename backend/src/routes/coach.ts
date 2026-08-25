import { Router, Request, Response } from 'express';
import { generateCoachMessage, CoachingInput } from '../coaching';
import logger from '../logger';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const {
    playerMoveSan, moveQuality, evalDropCp, scoreCp,
    bestMoveSan, mateIn, alternatives, pv, isOpponent,
    openingName, openingEco,
  } = req.body;

  const input: CoachingInput = {
    playerMoveSan: typeof playerMoveSan === 'string' ? playerMoveSan : null,
    moveQuality: typeof moveQuality === 'string' ? moveQuality : null,
    evalDropCp: typeof evalDropCp === 'number' ? evalDropCp : null,
    scoreCp: typeof scoreCp === 'number' ? scoreCp : 0,
    bestMoveSan: typeof bestMoveSan === 'string' ? bestMoveSan : null,
    mateIn: typeof mateIn === 'number' ? mateIn : null,
    alternatives: Array.isArray(alternatives) ? alternatives : [],
    pv: typeof pv === 'string' ? pv : null,
    isOpponent: isOpponent === true,
    openingName: typeof openingName === 'string' ? openingName : null,
    openingEco: typeof openingEco === 'string' ? openingEco : null,
  };

  try {
    const coachMessage = await generateCoachMessage(input);
    res.json({ coachMessage });
  } catch (err) {
    logger.error({ err }, 'POST /coach failed');
    res.status(500).json({ error: 'Coach unavailable' });
  }
});

export default router;
