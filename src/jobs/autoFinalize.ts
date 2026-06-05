import cron from 'node-cron';
import { db } from '../lib/db';

export function startAutoFinalizeJob() {
  // Every 5 minutes: schedules with salidaAt older than 6h → Finalizada
  cron.schedule('*/5 * * * *', async () => {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const result = await db.schedule.updateMany({
      where: {
        estado: { in: ['Habilitada', 'EnCurso'] },
        salidaAt: { lt: cutoff },
      },
      data: { estado: 'Finalizada' },
    });
    if (result.count > 0) {
      console.log(`[autoFinalize] ${result.count} habilitacion(es) finalizadas automaticamente`);
    }
  });
}
