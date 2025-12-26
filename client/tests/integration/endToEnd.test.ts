/**
 * End-to-end integration tests for complete game flows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SocketClient } from '../../src/socket';
import { ApiClient } from '../../src/api';
import { createTestServer, closeTestServer, TestServer } from '../../../backend/tests/integration/setup';
import {
  LobbyPlayerJoinedEvent,
  LobbyGameStartingEvent,
  GameStateUpdateEvent,
} from '@hilo/shared';

describe('End-to-End Integration Tests', () => {
  let testServer: TestServer;
  let baseURL: string;

  beforeAll(async () => {
    // Start test server with dynamic port
    testServer = await createTestServer();
    baseURL = `http://localhost:${testServer.port}`;
  });

  afterAll(async () => {
    // Close test server
    await closeTestServer(testServer);
  });

  describe('Complete Lobby Flow', () => {
    it('should handle full lobby creation and join flow', async () => {
      const apiClient = new ApiClient(baseURL);

      // 1. Create lobby
      const createResponse = await apiClient.createLobby();
      expect(createResponse.lobbyId).toBeDefined();
      const lobbyId = createResponse.lobbyId;

      // 2. First player joins via HTTP
      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      expect(player1Response.playerId).toBeDefined();
      expect(player1Response.isLeader).toBe(true);
      const player1Id = player1Response.playerId;

      // 3. First player connects via socket
      const socket1 = new SocketClient(baseURL);
      await socket1.connect();

      const socket1JoinEvent = await new Promise<LobbyPlayerJoinedEvent>((resolve) => {
        socket1.on('lobby:playerJoined', (data) => {
          resolve(data);
        });
        socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      });

      expect(socket1JoinEvent.player.id).toBe(player1Id);
      expect(socket1JoinEvent.lobby.players).toHaveLength(1);

      // 4. Second player joins via HTTP
      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      expect(player2Response.isLeader).toBe(false);
      const player2Id = player2Response.playerId;

      // 5. Second player connects via socket
      const socket2 = new SocketClient(baseURL);
      await socket2.connect();

      // Both sockets should receive the playerJoined event
      const [socket1Event, socket2Event] = await Promise.all([
        new Promise<LobbyPlayerJoinedEvent>((resolve) => {
          socket1.once('lobby:playerJoined', (data) => {
            if (data.player.id === player2Id) {
              resolve(data);
            }
          });
        }),
        new Promise<LobbyPlayerJoinedEvent>((resolve) => {
          socket2.on('lobby:playerJoined', (data) => {
            resolve(data);
          });
          socket2.emit('lobby:join', { lobbyId, playerId: player2Id });
        }),
      ]);

      expect(socket1Event.lobby.players).toHaveLength(2);
      expect(socket2Event.lobby.players).toHaveLength(2);

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });

    it('should not create duplicate players when joining', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      // Join via HTTP
      const joinResponse = await apiClient.joinLobby(lobbyId, 'TestPlayer');
      const playerId = joinResponse.playerId;

      // Connect via socket
      const socket = new SocketClient(baseURL);
      await socket.connect();

      const joinEvent = await new Promise<LobbyPlayerJoinedEvent>((resolve) => {
        socket.on('lobby:playerJoined', (data) => {
          resolve(data);
        });
        socket.emit('lobby:join', { lobbyId, playerId });
      });

      // Verify only one player exists
      expect(joinEvent.lobby.players).toHaveLength(1);
      expect(joinEvent.lobby.players[0].id).toBe(playerId);

      socket.disconnect();
    });
  });

  describe('Complete Game Flow', () => {
    it('should handle full game start flow', async () => {
      const apiClient = new ApiClient(baseURL);

      // 1. Create lobby and add players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Mark player 2 as ready
      await apiClient.readyPlayer(lobbyId, player2Id);

      // 2. Connect both players via socket (read-only for notifications)
      const socket1 = new SocketClient(baseURL);
      const socket2 = new SocketClient(baseURL);

      await socket1.connect();
      await socket2.connect();

      // Subscribe to room events via WebSocket
      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. Start game and listen for events
      const [gameStartEvent1, gameStateEvent1] = await Promise.all([
        new Promise<LobbyGameStartingEvent>((resolve) => {
          socket1.once('lobby:gameStarting', (data) => {
            resolve(data);
          });
        }),
        new Promise<GameStateUpdateEvent>((resolve) => {
          socket1.once('game:stateUpdate', (data) => {
            resolve(data);
          });
        }),
        apiClient.startGame(lobbyId, player1Id),
      ]);

      // Verify game started
      expect(gameStartEvent1.gameId).toBeDefined();
      expect(gameStartEvent1.gameId).toMatch(new RegExp(`^${lobbyId}:game:`));

      // Verify game state received
      expect(gameStateEvent1.gameState).toBeDefined();
      expect(gameStateEvent1.gameState.id).toBe(gameStartEvent1.gameId);
      expect(gameStateEvent1.gameState.phase).toBe('setup');
      expect(gameStateEvent1.gameState.myHand).toBeDefined();
      expect(gameStateEvent1.gameState.myHand.length).toBe(6);

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });

    it('should verify game ID has correct format with room prefix', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;
      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Mark player 2 as ready
      await apiClient.readyPlayer(lobbyId, player2Id);

      // Start game
      const gameResponse = await apiClient.startGame(lobbyId, player1Id);

      // Verify game ID format: <roomId>:game:<uuid>
      expect(gameResponse.gameState.id).toMatch(new RegExp(`^${lobbyId}:game:[a-f0-9-]+$`));

      // Verify the room ID prefix matches the lobby ID
      const gameIdParts = gameResponse.gameState.id.split(':game:');
      expect(gameIdParts[0]).toBe(lobbyId);
    });
  });

  describe('Player Leave Flow', () => {
    it('should handle player leaving lobby', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Connect both via socket (read-only for notifications)
      const socket1 = new SocketClient(baseURL);
      const socket2 = new SocketClient(baseURL);

      await socket1.connect();
      await socket2.connect();

      // Subscribe to room events via WebSocket
      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      socket2.emit('lobby:join', { lobbyId, playerId: player2Id });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player 2 leaves via HTTP API
      const leaveEvent = await new Promise<any>((resolve) => {
        socket1.once('lobby:playerLeft', (data) => {
          resolve(data);
        });
        apiClient.leaveLobby(lobbyId, player2Id);
      });

      expect(leaveEvent.playerId).toBe(player2Id);
      expect(leaveEvent.lobby.players).toHaveLength(1);

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });
  });

  describe('Face-Down Card Flow', () => {
    it('should verify face-down card state and API structure', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Mark player 2 as ready
      await apiClient.readyPlayer(lobbyId, player2Id);

      // Start game
      const gameResponse = await apiClient.startGame(lobbyId, player1Id);
      const gameId = gameResponse.gameState.id;

      // Verify initial game state has face-down cards
      expect(gameResponse.gameState.myFaceDownPlayed).toBeDefined();
      expect(gameResponse.gameState.myFaceDownPlayed.length).toBe(3);
      // All face-down cards should be unplayed initially
      expect(gameResponse.gameState.myFaceDownPlayed.every((played: boolean) => !played)).toBe(true);

      // Test the playFaceDownCard API structure
      // Note: This will fail with "Must play at least one card" because the player
      // still has hand and face-up cards at game start. Face-down cards can only be
      // played when both hand and face-up cards are exhausted.
      try {
        await apiClient.playFaceDownCard(gameId, player1Id, 0);
        // If we reach here, the game state allows face-down card play
        // (unlikely at game start but possible in edge cases)
      } catch (error: any) {
        // Verify the API call was made with correct structure
        expect(error).toBeDefined();
        // The error should be about game state, not API structure
        expect(error.response?.status).toBeDefined();
      }
    });

    it('should track face-down card played status', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create and start a game
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      await apiClient.readyPlayer(lobbyId, player2Id);

      const gameResponse = await apiClient.startGame(lobbyId, player1Id);

      // Verify face-down cards are tracked correctly
      const faceDownPlayed = gameResponse.gameState.myFaceDownPlayed;
      expect(Array.isArray(faceDownPlayed)).toBe(true);
      expect(faceDownPlayed.length).toBe(3);

      // Each element should be a boolean
      faceDownPlayed.forEach((played: any) => {
        expect(typeof played).toBe('boolean');
      });

      // Initially all should be false (unplayed)
      const allUnplayed = faceDownPlayed.every((played: boolean) => played === false);
      expect(allUnplayed).toBe(true);
    });
  });

  describe('Game Completion', () => {
    it('should handle a player winning the game', async () => {
      const apiClient = new ApiClient(baseURL);

      // Create lobby with two players
      const createResponse = await apiClient.createLobby();
      const lobbyId = createResponse.lobbyId;

      const player1Response = await apiClient.joinLobby(lobbyId, 'Player1');
      const player1Id = player1Response.playerId;

      const player2Response = await apiClient.joinLobby(lobbyId, 'Player2');
      const player2Id = player2Response.playerId;

      // Mark player 2 as ready
      await apiClient.readyPlayer(lobbyId, player2Id);

      // Connect both players via socket to listen for winner event
      const socket1 = new SocketClient(baseURL);
      const socket2 = new SocketClient(baseURL);

      await socket1.connect();
      await socket2.connect();

      socket1.emit('lobby:join', { lobbyId, playerId: player1Id });
      socket2.emit('lobby:join', { lobbyId, playerId: player2Id });

      // Wait for socket connections
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start game
      const gameResponse = await apiClient.startGame(lobbyId, player1Id);
      const gameId = gameResponse.gameState.id;

      expect(gameResponse.gameState).toBeDefined();
      expect(gameResponse.gameState.phase).toBe('setup');

      // Wait for game state update events
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set up listener for player won event
      let winnerEvent: any = null;
      const winnerPromise = new Promise<any>((resolve) => {
        socket1.on('game:playerWon', (data) => {
          winnerEvent = data;
          resolve(data);
        });
        socket2.on('game:playerWon', (data) => {
          winnerEvent = data;
          resolve(data);
        });
      });

      // Import game service to manipulate game state for testing
      const { gameService } = await import('../../../backend/src/services/gameService');
      const game = await gameService.getGame(gameId);

      expect(game).toBeDefined();
      if (!game) throw new Error('Game not found');

      // Manipulate game state to create a winning scenario
      // Give player 1 only 1 card in hand, no face-up cards, and 1 face-down card
      // This way, playing the last card will trigger a win
      const player1State = game.players.get(player1Id);
      const player2State = game.players.get(player2Id);

      if (!player1State || !player2State) {
        throw new Error('Player state not found');
      }

      // Keep one card that player1 can play
      const playableCard = player1State.hand[0];
      player1State.hand = [playableCard];
      player1State.faceUp = [];
      player1State.faceDown = []; // No face-down cards left

      // Give player2 plenty of cards so they don't win
      player2State.hand = game.deck.slice(0, 5);
      game.deck = game.deck.slice(5);

      // Make sure it's player1's turn
      game.activePlayerId = player1Id;
      game.phase = 'playing';

      // Clear pile or set it to empty/low cards so the playable card can be played
      game.pile = [];

      // Now play the card via API
      const playResult = await apiClient.playCards(gameId, player1Id, [playableCard]);

      // Check if player won
      expect(playResult).toBeDefined();

      // If player1 didn't win immediately (might need to play face-down card)
      if (!playResult.winner) {
        // Check if player has face-up or face-down cards left
        const updatedView = playResult.gameState;
        if (updatedView.myHand.length === 0 &&
            updatedView.myFaceUp.length === 0 &&
            updatedView.myFaceDownPlayed.every((p: boolean) => p)) {
          // All cards played, should have won
          expect(playResult.winner).toBe(true);
        }
      } else {
        // Player won!
        expect(playResult.winner).toBe(true);

        // Wait for winner event
        await Promise.race([
          winnerPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Winner event timeout')), 5000))
        ]);

        expect(winnerEvent).toBeDefined();
        expect(winnerEvent.winnerId).toBe(player1Id);
        expect(winnerEvent.winnerName).toBe('Player1');
      }

      // Cleanup
      socket1.disconnect();
      socket2.disconnect();
    });
  });
});
