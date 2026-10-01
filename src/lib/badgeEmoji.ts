export const badgeEmoji = (key: string) =>
  key === 'first_visit' ? '👟'
  : key.startsWith('visits_') ? '🏅'
  : key === 'goal_first' ? '🎯'
  : key.startsWith('streak_') ? '🔥'
  : key === 'week_5' ? '💥'
  : key === 'early_bird' ? '🌅'
  : key === 'comeback' ? '🔄'
  : '⭐'
