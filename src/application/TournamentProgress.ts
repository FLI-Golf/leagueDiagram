export const hasNextTournament = (currentIndex: number, total: number): boolean => currentIndex >= 0 && currentIndex < total - 1;

export const getNextTournamentIndex = (currentIndex: number, total: number): number => {
  if (!hasNextTournament(currentIndex, total)) {
    return Math.min(Math.max(currentIndex, 0), Math.max(total - 1, 0));
  }

  return currentIndex + 1;
};
