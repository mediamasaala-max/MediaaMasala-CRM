import prisma from '../lib/prisma';

// SRE: PII Scrubbing to prevent secret leakage in audit logs
const scrubMetadata = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  const sensitiveKeys = ['password', 'token', 'secret', 'passwordHash', 'hashedPassword'];
  const scrubbed = { ...data };
  for (const key in scrubbed) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof scrubbed[key] === 'object') {
      scrubbed[key] = scrubMetadata(scrubbed[key]);
    }
  }
  return scrubbed;
};

export const logActivity = async ({
  employeeId,
  module,
  action,
  entityId,
  entityName,
  description,
  metadata
}: {
  employeeId: number;
  module: string;
  action: string;
  entityId?: string;
  entityName?: string;
  description: string;
  metadata?: any;
}) => {
  try {
    const finalMetadata = metadata ? scrubMetadata(metadata) : undefined;
    
    await (prisma as any).activityLog.create({
      data: {
        employeeId,
        module,
        action,
        entityId: entityId?.toString(),
        entityName,
        description,
        metadata: finalMetadata ? JSON.parse(JSON.stringify(finalMetadata)) : undefined
      }
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};
