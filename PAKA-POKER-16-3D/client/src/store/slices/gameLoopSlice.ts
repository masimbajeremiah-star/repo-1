export type GameLoopState = {
  isRunning: boolean;
  elapsedSeconds: number;
};

export const initialGameLoopState: GameLoopState = {
  isRunning: false,
  elapsedSeconds: 0,
};

export const toggleGameLoop = () => ({
  type: 'TOGGLE_GAME_LOOP',
});

export const tickGameLoop = (seconds: number) => ({
  type: 'TICK_GAME_LOOP',
  payload: seconds,
});
