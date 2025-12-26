/**
 * Game state management service
 */

import { GameState, PlayerView } from '@hilo/shared';
import { PlayerId } from '@hilo/shared';
import { Card } from '@hilo/shared';
import {
  initializeGame,
  dealCards,
  selectFaceUpCards,
  startGame,
  playCards,
  pickupPile,
  getPlayableCards as getPlayableCardsFromEngine,
} from './gameEngine';
import { LobbyId } from '@hilo/shared';
import { redisService } from './redisService';

export class GameService {
  private games: Map<string, GameState> = new Map();
  // Map room ID to current game ID (one active game per room)
  private roomToGame: Map<LobbyId, string> = new Map();
  // Map game ID to room ID for reverse lookup
  private gameToRoom: Map<string, LobbyId> = new Map();

  /**
   * Create a new game in a room
   * @param roomId - The room ID (lobbyId from HTTP API serves as room ID)
   * @param playerIds - Array of player IDs in turn order
   * @returns The initialized game state
   */
  createGame(roomId: LobbyId, playerIds: PlayerId[]): GameState {
    const gameState = initializeGame(playerIds, roomId);
    const dealtState = dealCards(gameState);

    this.games.set(dealtState.id, dealtState);
    this.roomToGame.set(roomId, dealtState.id);
    this.gameToRoom.set(dealtState.id, roomId);

    // Persist to Redis (non-blocking)
    redisService.saveGameState(dealtState).catch((err) => {
      console.error('[GameService] Failed to persist game state to Redis:', err);
    });

    return dealtState;
  }

  /**
   * Get game by game ID
   * @param gameId - The game ID
   * @returns The game state or null if not found
   */
  getGame(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  /**
   * Get game by room ID
   * @param roomId - The room ID
   * @returns The game state or null if not found
   */
  getGameByRoom(roomId: LobbyId): GameState | null {
    const gameId = this.roomToGame.get(roomId);
    if (!gameId) {
      return null;
    }
    return this.getGame(gameId);
  }

  /**
   * Update game state
   * @param gameId - The game ID
   * @param gameState - The updated game state
   */
  updateGame(gameId: string, gameState: GameState): void {
    this.games.set(gameId, gameState);

    // Persist to Redis (non-blocking)
    redisService.saveGameState(gameState).catch((err) => {
      console.error('[GameService] Failed to persist game state to Redis:', err);
    });
  }

  /**
   * Remove a game
   * @param gameId - The game ID
   */
  removeGame(gameId: string): void {
    const roomId = this.gameToRoom.get(gameId);
    this.games.delete(gameId);
    this.gameToRoom.delete(gameId);
    if (roomId) {
      this.roomToGame.delete(roomId);
    }
  }

  /**
   * Get room ID from game ID
   * @param gameId - The game ID
   * @returns The room ID or null if not found
   */
  getRoomIdFromGame(gameId: string): LobbyId | null {
    return this.gameToRoom.get(gameId) || null;
  }

  /**
   * Get personalized player view of game state
   * @param gameId - The game ID
   * @param playerId - The player ID requesting the view
   * @returns PlayerView with hidden information filtered
   */
  getPlayerView(gameId: string, playerId: PlayerId): PlayerView | null {
    const game = this.getGame(gameId);
    if (!game) {
      return null;
    }

    const playerState = game.players.get(playerId);
    if (!playerState) {
      return null;
    }

    // Build other players object
    const otherPlayers: { [playerId: string]: { handCount: number; faceUp: Card[]; faceDownCount: number } } = {};

    for (const [pid, pState] of game.players) {
      if (pid !== playerId) {
        otherPlayers[pid] = {
          handCount: pState.hand.length,
          faceUp: pState.faceUp,
          faceDownCount: pState.faceDown.length,
        };
      }
    }

    // Include playable cards only for the active player
    const playableCards = playerId === game.activePlayerId ? this.getPlayableCards(game, playerId) : undefined;

    return {
      id: game.id,
      phase: game.phase,
      myHand: playerState.hand,
      myFaceUp: playerState.faceUp,
      myFaceDownCount: playerState.faceDown.length,
      myFaceDownPlayed: playerState.faceDown.map(card => card === null),
      otherPlayers,
      pile: game.pile,
      deckCount: game.deck.length,
      activePlayerId: game.activePlayerId,
      playableCards,
      winner: game.winner,
    };
  }

  /**
   * Get playable cards for a player
   * @param game - The game state
   * @param playerId - The player ID
   * @returns Array of playable cards
   */
  private getPlayableCards(game: GameState, playerId: PlayerId): Card[] {
    const playerState = game.players.get(playerId);
    if (!playerState) {
      return [];
    }

    // Check hand first
    if (playerState.hand.length > 0) {
      return getPlayableCardsFromEngine(playerState.hand, game.pile);
    }

    // Then face-up cards
    if (playerState.faceUp.length > 0) {
      return getPlayableCardsFromEngine(playerState.faceUp, game.pile);
    }

    // Face-down cards are always playable (blind play)
    // Don't reveal actual cards - return empty array
    // Client will handle facedown card selection by index
    return [];
  }

  /**
   * Handle player selecting face-up cards during setup
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param cardIndices - Indices of cards to select as face-up
   * @returns Updated game state
   */
  selectFaceUp(gameId: string, playerId: PlayerId, cardIndices: number[]): GameState {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedGame = selectFaceUpCards(game, playerId, cardIndices);
    this.updateGame(gameId, updatedGame);

    return updatedGame;
  }

  /**
   * Check if all players have selected face-up cards
   * @param gameId - The game ID
   * @returns true if all players ready
   */
  allPlayersReady(gameId: string): boolean {
    const game = this.getGame(gameId);
    if (!game) {
      return false;
    }

    for (const playerState of game.players.values()) {
      if (playerState.faceUp.length !== 3) {
        return false;
      }
    }

    return true;
  }

  /**
   * Start the game (transition from setup to playing)
   * @param gameId - The game ID
   * @returns Updated game state
   */
  startGamePlay(gameId: string): GameState {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedGame = startGame(game);
    this.updateGame(gameId, updatedGame);

    return updatedGame;
  }

  /**
   * Play cards from hand, face-up, or face-down
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param cards - The cards to play
   * @param faceDownIndex - Index of facedown card to play (if playing facedown)
   * @returns Updated game state and metadata about the action
   */
  playCardsAction(
    gameId: string,
    playerId: PlayerId,
    cards: Card[],
    providedFaceDownIndex?: number
  ): { gameState: GameState; blowUp: boolean; winner: boolean } {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const playerState = game.players.get(playerId);
    if (!playerState) {
      throw new Error('Player not found');
    }

    // Determine source of cards
    let source: 'hand' | 'faceUp' | 'faceDown' = 'hand';
    let faceDownIndex: number | undefined;

    if (playerState.hand.length > 0) {
      source = 'hand';
    } else if (playerState.faceUp.length > 0) {
      source = 'faceUp';
    } else if (!playerState.faceDown.every(card => card === null)) {
      source = 'faceDown';
      // Use provided index for facedown cards
      faceDownIndex = providedFaceDownIndex;
    }

    const oldPileLength = game.pile.length;
    const updatedGame = playCards(game, playerId, cards, source, faceDownIndex);
    this.updateGame(gameId, updatedGame);

    // Check if blow-up occurred (pile cleared)
    const blowUp = updatedGame.pile.length === 0 && oldPileLength > 0;

    // Check if player won
    const winner = updatedGame.phase === 'ended' && updatedGame.winner === playerId;

    return { gameState: updatedGame, blowUp, winner };
  }

  /**
   * Pick up the pile
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @returns Updated game state
   */
  pickUpPileAction(gameId: string, playerId: PlayerId): GameState {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedGame = pickupPile(game, playerId);
    this.updateGame(gameId, updatedGame);

    return updatedGame;
  }

  /**
   * Clear all games (for testing)
   */
  clearAll(): void {
    this.games.clear();
    this.roomToGame.clear();
    this.gameToRoom.clear();
  }
}

// Singleton instance
export const gameService = new GameService();
