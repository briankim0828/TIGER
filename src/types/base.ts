// Core shared UI/domain primitive constants retained after legacy type removal
// Only keep what active code still consumes (WeekDay, WEEKDAYS, BODY_PARTS, BodyPart type)

export const WEEKDAYS = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
] as const;
export type WeekDay = typeof WEEKDAYS[number];

export const BODY_PARTS = [
  'Chest',
  'Back',
  'Legs',
  'Arms',
  'Shoulders',
  'Core',
  'Cardio',
] as const;
export type BodyPart = typeof BODY_PARTS[number];
