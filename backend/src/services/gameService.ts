/**
 * Game state management service
 */

import { GameState, PlayerView, LastAction } from '@hilo/shared';
import { PlayerId } from '@hilo/shared';
import { Card, DeckStrategy } from '@hilo/shared';
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
  /**
   * Create a new game in a room
   * @param roomId - The room ID (lobbyId from HTTP API serves as room ID)
   * @param playerIds - Array of player IDs in turn order
   * @param deckStrategy - The deck strategy to use (defaults to 'standard')
   * @returns The initialized game state
   */
  async createGame(roomId: LobbyId, playerIds: PlayerId[], deckStrategy: DeckStrategy = 'standard'): Promise<GameState> {
    const gameState = initializeGame(playerIds, deckStrategy);
    const dealtState = dealCards(gameState);

    console.log(`[GameService] Creating game - roomId: ${roomId.substring(0, 8)}, gameId: ${dealtState.id}, strategy: ${deckStrategy}`);

    // Save to Redis as source of truth
    await redisService.saveGameState(dealtState);

    // Save room-to-game and game-to-room mappings
    await this.saveRoomMapping(roomId, dealtState.id);

    return dealtState;
  }

  /**
   * Save room-to-game mapping in Redis
   */
  private async saveRoomMapping(roomId: LobbyId, gameId: string): Promise<void> {
    if (!redisService.isAvailable()) return;

    try {
      const client = redisService.getClient();
      await client.set(`hilo:room:${roomId}:game`, gameId);
      await client.set(`hilo:game:${gameId}:room`, roomId);
    } catch (error) {
      console.error('[GameService] Failed to save room mapping:', error);
    }
  }

  /**
   * Get game ID from room ID
   */
  private async getGameIdByRoom(roomId: LobbyId): Promise<string | null> {
    if (!redisService.isAvailable()) return null;

    try {
      const client = redisService.getClient();
      return await client.get(`hilo:room:${roomId}:game`);
    } catch (error) {
      console.error('[GameService] Failed to get game ID by room:', error);
      return null;
    }
  }

  /**
   * Get room ID from game ID
   */
  private async getRoomIdByGameId(gameId: string): Promise<LobbyId | null> {
    if (!redisService.isAvailable()) return null;

    try {
      const client = redisService.getClient();
      const roomId = await client.get(`hilo:game:${gameId}:room`);
      return roomId as LobbyId | null;
    } catch (error) {
      console.error('[GameService] Failed to get room ID by game:', error);
      return null;
    }
  }

  /**
   * Get game by game ID
   * @param gameId - The game ID
   * @returns The game state or null if not found
   */
  async getGame(gameId: string): Promise<GameState | null> {
    const gameState = await redisService.getGameState(gameId);
    console.log(`[GameService] getGame - gameId: ${gameId.substring(0, 20)}..., found: ${gameState !== null}`);
    return gameState;
  }

  /**
   * Get game by room ID
   * @param roomId - The room ID
   * @returns The game state or null if not found
   */
  async getGameByRoom(roomId: LobbyId): Promise<GameState | null> {
    const gameId = await this.getGameIdByRoom(roomId);
    if (!gameId) {
      return null;
    }
    return await this.getGame(gameId);
  }

  /**
   * Update game state
   * @param gameId - The game ID
   * @param gameState - The updated game state
   */
  async updateGame(gameId: string, gameState: GameState): Promise<void> {
    await redisService.saveGameState(gameState);
  }

  /**
   * Remove a game
   * @param gameId - The game ID
   */
  async removeGame(gameId: string): Promise<void> {
    const roomId = await this.getRoomIdByGameId(gameId);

    // Delete game state from Redis
    await redisService.deleteGame(gameId);

    // Delete mappings
    if (redisService.isAvailable()) {
      try {
        const client = redisService.getClient();
        await client.del(`hilo:game:${gameId}:room`);
        if (roomId) {
          await client.del(`hilo:room:${roomId}:game`);
        }
      } catch (error) {
        console.error('[GameService] Failed to delete game mappings:', error);
      }
    }
  }

  /**
   * Get room ID from game ID
   * @param gameId - The game ID
   * @returns The room ID or null if not found
   */
  async getRoomIdFromGame(gameId: string): Promise<LobbyId | null> {
    return await this.getRoomIdByGameId(gameId);
  }

  /**
   * Get personalized player view of game state
   * @param gameId - The game ID
   * @param playerId - The player ID requesting the view
   * @returns PlayerView with hidden information filtered
   */
  async getPlayerView(gameId: string, playerId: PlayerId): Promise<PlayerView | null> {
    const game = await this.getGame(gameId);
    if (!game) {
      return null;
    }

    const playerState = game.players.get(playerId);
    if (!playerState) {
      return null;
    }

    // Get lobby to fetch player names
    const lobbyId = await this.getRoomIdByGameId(gameId);
    const lobby = lobbyId ? await redisService.getLobby(lobbyId) : null;

    // Build player names map
    const playerNames: { [playerId: string]: string } = {};
    if (lobby) {
      for (const [pid, player] of lobby.players) {
        playerNames[pid] = player.name;
      }
    }

    // Build other players object
    const otherPlayers: { [playerId: string]: { name: string; handCount: number; faceUp: Card[]; faceDownCount: number } } = {};

    for (const [pid, pState] of game.players) {
      if (pid !== playerId) {
        otherPlayers[pid] = {
          name: playerNames[pid] || `Player ${pid.substring(0, 8)}`,
          handCount: pState.hand.length,
          faceUp: pState.faceUp,
          faceDownCount: pState.faceDown.filter(card => card !== null).length,
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
      myFaceDownCount: playerState.faceDown.filter(card => card !== null).length,
      myFaceDownPlayed: playerState.faceDown.map(card => card === null),
      otherPlayers,
      pile: game.pile,
      deckCount: game.deck.length,
      activePlayerId: game.activePlayerId,
      playableCards,
      winner: game.winner,
      winnerName: game.winner ? playerNames[game.winner] : undefined,
      playerNames,
      lastAction: game.lastAction,
      turnOrder: game.turnOrder,
      stateVersion: game.stateVersion,
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
   * @param playerName - The player's display name
   * @param cardIndices - Indices of cards to select as face-up
   * @returns Updated game state
   */
  async selectFaceUp(gameId: string, playerId: PlayerId, playerName: string, cardIndices: number[]): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedGame = selectFaceUpCards(game, playerId, cardIndices);

    // Get the selected cards for lastAction
    const playerState = updatedGame.players.get(playerId);
    const selectedCards = playerState?.faceUp || [];

    // Set lastAction
    updatedGame.lastAction = {
      type: 'select_faceup',
      playerId,
      playerName,
      cards: selectedCards,
      timestamp: new Date().toISOString(),
    };

    await this.updateGame(gameId, updatedGame);

    return updatedGame;
  }

  /**
   * Check if all players have selected face-up cards
   * @param gameId - The game ID
   * @returns true if all players ready
   */
  async allPlayersReady(gameId: string): Promise<boolean> {
    const game = await this.getGame(gameId);
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
  async startGamePlay(gameId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const updatedGame = startGame(game);
    await this.updateGame(gameId, updatedGame);

    return updatedGame;
  }

  /**
   * Play cards from hand, face-up, or face-down
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param playerName - The player's display name
   * @param cards - The cards to play
   * @param faceDownIndex - Index of facedown card to play (if playing facedown)
   * @returns Updated game state and metadata about the action
   */
  async playCardsAction(
    gameId: string,
    playerId: PlayerId,
    playerName: string,
    cards: Card[],
    providedFaceDownIndex?: number
  ): Promise<{ gameState: GameState; blowUp: boolean; winner: boolean; cardsPlayed: Card[]; pickedUpPile: boolean }> {
    const game = await this.getGame(gameId);
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
    let actualCardsPlayed: Card[] = cards;

    if (playerState.hand.length > 0) {
      source = 'hand';
    } else if (playerState.faceUp.length > 0) {
      source = 'faceUp';
    } else if (!playerState.faceDown.every(card => card === null)) {
      source = 'faceDown';
      // Use provided index for facedown cards
      faceDownIndex = providedFaceDownIndex;
      // For facedown cards, get the actual card from the player state
      if (faceDownIndex !== undefined && faceDownIndex >= 0 && faceDownIndex < playerState.faceDown.length) {
        const faceDownCard = playerState.faceDown[faceDownIndex];
        if (faceDownCard !== null) {
          actualCardsPlayed = [faceDownCard];
        }
      }
    }

    const oldPileLength = game.pile.length;
    const oldPlayerHandSize = playerState.hand.length;
    const updatedGame = playCards(game, playerId, cards, source, faceDownIndex);

    // Check if player picked up the pile (hand size increased significantly)
    const updatedPlayerState = updatedGame.players.get(playerId);
    const newHandSize = updatedPlayerState?.hand.length ?? 0;
    const pickedUpPile = newHandSize > oldPlayerHandSize + 1;

    // Check if blow-up occurred (pile cleared and cards were on pile, but NOT from pickup)
    const blowUp = !pickedUpPile && updatedGame.pile.length === 0 && oldPileLength > 0;

    // Set lastAction on the game state
    // pickedUpPile takes precedence: if player picked up pile, it's not a blow-up
    const lastAction: LastAction = {
      type: pickedUpPile ? 'pickup_pile' : blowUp ? 'blow_up' : 'play_cards',
      playerId,
      playerName,
      cards: actualCardsPlayed,
      timestamp: new Date().toISOString(),
    };

    if (blowUp) {
      lastAction.blowUpReason = actualCardsPlayed[0]?.rank === '10' ? 'ten' : 'four_of_kind';
    }

    if (pickedUpPile) {
      lastAction.pickedUpCount = newHandSize - oldPlayerHandSize;
    }

    updatedGame.lastAction = lastAction;
    await this.updateGame(gameId, updatedGame);

    // Check if player won
    const winner = updatedGame.phase === 'ended' && updatedGame.winner === playerId;

    return { gameState: updatedGame, blowUp, winner, cardsPlayed: actualCardsPlayed, pickedUpPile };
  }

  /**
   * Pick up the pile
   * @param gameId - The game ID
   * @param playerId - The player ID
   * @param playerName - The player's display name
   * @returns Updated game state
   */
  async pickUpPileAction(gameId: string, playerId: PlayerId, playerName: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    const pileCount = game.pile.length;
    const updatedGame = pickupPile(game, playerId);

    // Set lastAction
    updatedGame.lastAction = {
      type: 'pickup_pile',
      playerId,
      playerName,
      pickedUpCount: pileCount,
      timestamp: new Date().toISOString(),
    };

    await this.updateGame(gameId, updatedGame);

    return updatedGame;
  }

  /**
   * Clear all games (for testing)
   */
  async clearAll(): Promise<void> {
    // Note: This will only clear games from Redis if it's available
    // In tests with redis-mock, this should work fine
    // For production, you might want to implement a scan/delete pattern
    console.warn('[GameService] clearAll() does not delete Redis data - for testing with mock only');
  }

  /**
   * Get or create a "play again" lobby for an ended game.
   * This is idempotent - all players calling this for the same gameId get the same lobbyId.
   * @param gameId - The game ID that has ended
   * @returns The lobby ID to join for a rematch
   * @throws Error if game not found or game hasn't ended
   */
  async getOrCreatePlayAgainLobby(gameId: string): Promise<LobbyId> {
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.phase !== 'ended') {
      throw new Error('Game has not ended yet');
    }

    // Check if we already have a play-again lobby for this game
    const existingLobbyId = await this.getPlayAgainLobby(gameId);
    if (existingLobbyId) {
      // Verify the lobby still exists
      const lobby = await redisService.getLobby(existingLobbyId);
      if (lobby) {
        return existingLobbyId;
      }
      // Lobby was deleted, remove the mapping and create a new one
      await this.deletePlayAgainMapping(gameId);
    }

    // Create a new lobby for play again
    const { lobbyService } = await import('./lobbyService');
    const newLobby = await lobbyService.createLobby();

    // Save the mapping
    await this.savePlayAgainMapping(gameId, newLobby.id);

    return newLobby.id;
  }

  /**
   * Get the play-again lobby ID for a game
   */
  private async getPlayAgainLobby(gameId: string): Promise<LobbyId | null> {
    if (!redisService.isAvailable()) return null;

    try {
      const client = redisService.getClient();
      const lobbyId = await client.get(`hilo:game:${gameId}:playagain`);
      return lobbyId as LobbyId | null;
    } catch (error) {
      console.error('[GameService] Failed to get play-again lobby:', error);
      return null;
    }
  }

  /**
   * Save the play-again lobby mapping
   */
  private async savePlayAgainMapping(gameId: string, lobbyId: LobbyId): Promise<void> {
    if (!redisService.isAvailable()) return;

    try {
      const client = redisService.getClient();
      // Set with 1 hour expiry - players should join within that time
      await client.set(`hilo:game:${gameId}:playagain`, lobbyId, { EX: 3600 });
    } catch (error) {
      console.error('[GameService] Failed to save play-again mapping:', error);
    }
  }

  /**
   * Delete the play-again lobby mapping
   */
  private async deletePlayAgainMapping(gameId: string): Promise<void> {
    if (!redisService.isAvailable()) return;

    try {
      const client = redisService.getClient();
      await client.del(`hilo:game:${gameId}:playagain`);
    } catch (error) {
      console.error('[GameService] Failed to delete play-again mapping:', error);
    }
  }
}

// Singleton instance
export const gameService = new GameService();
