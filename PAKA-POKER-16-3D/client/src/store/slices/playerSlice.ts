import { Player } from '../../types/game';

export type PlayerState = {
  players: Player[];
};

export const initialPlayerState: PlayerState = {
  players: [],
};

export const addPlayer = (player: Player) => ({
  type: 'ADD_PLAYER',
  payload: player,
});

export const removePlayer = (playerId: string) => ({
  type: 'REMOVE_PLAYER',
  payload: playerId,
});
