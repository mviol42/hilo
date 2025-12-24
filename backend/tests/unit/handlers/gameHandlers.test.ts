/**
 * Unit tests for Socket.IO game handlers
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SocketServerMock } from 'socket.io-mock-ts';
import {
  registerGameHandlers,
  TypedServer,
  TypedSocket,
} from '../../../src/handlers/gameHandlers';
import { gameService } from '../../../src/services/gameService';
import { GameState, PlayerGameState, Card } from '@hilo/shared';

// Mock the gameService
vi.mock('../../../src/services/gameService', () => ({
  gameService: {
    getGame: vi.fn(),
    selectFaceUp: vi.fn(),
    allPlayersReady: vi.fn(),
    startGamePlay: vi.fn(),
    getRoomIdFromGame: vi.fn(),
    getPlayerView: vi.fn(),
    playCardsAction: vi.fn(),
    pickUpPileAction: vi.fn(),
  },
}));

describe('Game Handlers', () => {
  let mockServer: TypedServer;
  let mockSocket: TypedSocket;
  let mockClientSocket: any;
  let socketServerMock: SocketServerMock;

  const testGameId = 'test-game-id';
  const testRoomId = 'test-room-id';
  const testPlayerId1 = 'player1';
  const testPlayerId2 = 'player2';

  const createMockGame = (overrides?: Partial<GameState>): GameState => {
    const player1State: PlayerGameState = {
      hand: [
        { rank: '3', suit: 'hearts' },
        { rank: '4', suit: 'diamonds' },
        { rank: '5', suit: 'clubs' },
        { rank: '6', suit: 'spades' },
        { rank: '7', suit: 'hearts' },
        { rank: '8', suit: 'diamonds' },
      ],
      faceUp: [],
      faceDown: [
        { rank: '9', suit: 'clubs' },
        { rank: '10', suit: 'spades' },
        { rank: 'J', suit: 'hearts' },
      ],
    };

    const player2State: PlayerGameState = {
      hand: [
        { rank: 'Q', suit: 'diamonds' },
        { rank: 'K', suit: 'clubs' },
        { rank: 'A', suit: 'spades' },
      ],
      faceUp: [],
      faceDown: [],
    };

    const defaultGame: GameState = {
      id: testGameId,
      phase: 'setup',
      players: new Map([
        [testPlayerId1, player1State],
        [testPlayerId2, player2State],
      ]),
      deck: [],
      pile: [],
      discardPile: [],
      activePlayerId: testPlayerId1,
      turnOrder: [testPlayerId1, testPlayerId2],
      log: [],
      ...overrides,
    };

    return defaultGame;
  };

  beforeEach(() => {
    socketServerMock = new SocketServerMock();
    mockSocket = socketServerMock as unknown as TypedSocket;
    mockClientSocket = socketServerMock.clientMock;

    // Create a mock server
    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      in: vi.fn().mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([
          {
            data: { playerId: testPlayerId1 },
            emit: vi.fn(),
          },
          {
            data: { playerId: testPlayerId2 },
            emit: vi.fn(),
          },
        ]),
      }),
    } as unknown as TypedServer;

    // Add socket.data property and emit method
    mockSocket.data = { playerId: testPlayerId1 };
    mockSocket.emit = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();

    // Register handlers
    registerGameHandlers(mockServer, mockSocket);
  });

  describe('handleSelectFaceUp', () => {
    const cards: Card[] = [
      { rank: '3', suit: 'hearts' },
      { rank: '4', suit: 'diamonds' },
      { rank: '5', suit: 'clubs' },
    ];

    it('should handle successful face-up card selection', async () => {
      const mockGame = createMockGame();
      const updatedGame = createMockGame({
        players: new Map([
          [
            testPlayerId1,
            {
              hand: [
                { rank: '6', suit: 'spades' },
                { rank: '7', suit: 'hearts' },
                { rank: '8', suit: 'diamonds' },
              ],
              faceUp: cards,
              faceDown: mockGame.players.get(testPlayerId1)!.faceDown,
            },
          ],
          [testPlayerId2, mockGame.players.get(testPlayerId2)!],
        ]),
      });

      (gameService.getGame as Mock).mockReturnValue(mockGame);
      (gameService.selectFaceUp as Mock).mockReturnValue(updatedGame);
      (gameService.allPlayersReady as Mock).mockReturnValue(false);
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'setup',
        myHand: [],
        myFaceUp: cards,
        myFaceDownCount: 3,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      });

      mockClientSocket.emit('game:selectFaceUp', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(gameService.getGame).toHaveBeenCalledWith(testGameId);
      expect(gameService.selectFaceUp).toHaveBeenCalledWith(testGameId, testPlayerId1, [0, 1, 2]);
    });

    it('should start game when all players are ready', async () => {
      const mockGame = createMockGame();
      const updatedGame = createMockGame({ phase: 'playing' });
      const startedGame = createMockGame({ phase: 'playing' });

      (gameService.getGame as Mock).mockReturnValue(mockGame);
      (gameService.selectFaceUp as Mock).mockReturnValue(updatedGame);
      (gameService.allPlayersReady as Mock).mockReturnValue(true);
      (gameService.startGamePlay as Mock).mockReturnValue(startedGame);
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'playing',
        myHand: [],
        myFaceUp: cards,
        myFaceDownCount: 3,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      });

      mockClientSocket.emit('game:selectFaceUp', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(gameService.allPlayersReady).toHaveBeenCalledWith(testGameId);
      expect(gameService.startGamePlay).toHaveBeenCalledWith(testGameId);
      expect(mockServer.to).toHaveBeenCalledWith(testRoomId);
    });

    it('should emit error when game not found', async () => {
      (gameService.getGame as Mock).mockReturnValue(null);

      mockClientSocket.emit('game:selectFaceUp', {
        gameId: 'non-existent',
        playerId: testPlayerId1,
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Game not found' });
    });

    it('should emit error when player not found', async () => {
      const mockGame = createMockGame();
      (gameService.getGame as Mock).mockReturnValue(mockGame);

      mockClientSocket.emit('game:selectFaceUp', {
        gameId: testGameId,
        playerId: 'non-existent-player',
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Player not found' });
    });

    it('should emit error when card not in hand', async () => {
      const mockGame = createMockGame();
      (gameService.getGame as Mock).mockReturnValue(mockGame);

      const invalidCards: Card[] = [
        { rank: 'Q', suit: 'hearts' }, // Not in player1's hand
        { rank: 'K', suit: 'diamonds' },
        { rank: 'A', suit: 'clubs' },
      ];

      mockClientSocket.emit('game:selectFaceUp', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: invalidCards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Card not in hand' });
    });

    it('should handle room not found gracefully', async () => {
      const mockGame = createMockGame();
      const updatedGame = createMockGame({ phase: 'playing' });
      const startedGame = createMockGame({ phase: 'playing' });

      (gameService.getGame as Mock).mockReturnValue(mockGame);
      (gameService.selectFaceUp as Mock).mockReturnValue(updatedGame);
      (gameService.allPlayersReady as Mock).mockReturnValue(true);
      (gameService.startGamePlay as Mock).mockReturnValue(startedGame);
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(null);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'playing',
        myHand: [],
        myFaceUp: cards,
        myFaceDownCount: 3,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      });

      mockClientSocket.emit('game:selectFaceUp', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not emit turn change if no room
      expect(mockServer.to).not.toHaveBeenCalled();
    });
  });

  describe('handlePlayCards', () => {
    const cardsToPlay: Card[] = [{ rank: '5', suit: 'hearts' }];

    it('should handle successful card play', async () => {
      const mockGame = createMockGame({ phase: 'playing' });
      const updatedGame = createMockGame({ phase: 'playing' });

      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: updatedGame,
        blowUp: false,
        winner: false,
      });
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: cardsToPlay,
        deckCount: 0,
        activePlayerId: testPlayerId2,
      });

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: cardsToPlay,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(gameService.playCardsAction).toHaveBeenCalledWith(testGameId, testPlayerId1, cardsToPlay);
      expect(mockServer.to).toHaveBeenCalledWith(testRoomId);
    });

    it('should emit pile blown event when ten is played', async () => {
      const tenCard: Card[] = [{ rank: '10', suit: 'hearts' }];
      const mockGame = createMockGame({ phase: 'playing' });
      const updatedGame = createMockGame({ phase: 'playing', pile: [] });

      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: updatedGame,
        blowUp: true,
        winner: false,
      });
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      });

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: tenCard,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.to).toHaveBeenCalledWith(testRoomId);
      expect(mockServer.emit).toHaveBeenCalledWith('game:pileBlown', {
        playerId: testPlayerId1,
        reason: 'ten',
      });
    });

    it('should emit pile blown event when four of a kind is played', async () => {
      const cards: Card[] = [{ rank: '5', suit: 'hearts' }];
      const mockGame = createMockGame({ phase: 'playing' });
      const updatedGame = createMockGame({ phase: 'playing', pile: [] });

      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: updatedGame,
        blowUp: true,
        winner: false,
      });
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      });

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.emit).toHaveBeenCalledWith('game:pileBlown', {
        playerId: testPlayerId1,
        reason: 'four_of_kind',
      });
    });

    it('should emit player won event when player wins', async () => {
      const cards: Card[] = [{ rank: '5', suit: 'hearts' }];
      const mockGame = createMockGame({ phase: 'playing' });
      const updatedGame = createMockGame({
        phase: 'ended',
        winner: testPlayerId1,
      });

      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: updatedGame,
        blowUp: false,
        winner: true,
      });
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'ended',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: cards,
        deckCount: 0,
        activePlayerId: testPlayerId1,
        winner: testPlayerId1,
      });

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.emit).toHaveBeenCalledWith('game:playerWon', {
        winnerId: testPlayerId1,
        winnerName: expect.any(String),
      });
    });

    it('should emit error when play fails', async () => {
      (gameService.playCardsAction as Mock).mockImplementation(() => {
        throw new Error('Invalid card play');
      });

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: cardsToPlay,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Invalid card play' });
    });

    it('should return early when room not found', async () => {
      const mockGame = createMockGame({ phase: 'playing' });
      const updatedGame = createMockGame({ phase: 'playing' });

      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: updatedGame,
        blowUp: false,
        winner: false,
      });
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(null);

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: cardsToPlay,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not emit any events if no room
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should handle generic error with default message', async () => {
      (gameService.playCardsAction as Mock).mockImplementation(() => {
        throw 'Some non-Error object';
      });

      mockClientSocket.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: cardsToPlay,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Failed to play cards' });
    });
  });

  describe('handlePickUpPile', () => {
    it('should handle successful pile pickup', async () => {
      const updatedGame = createMockGame({
        phase: 'playing',
        activePlayerId: testPlayerId2,
      });

      (gameService.pickUpPileAction as Mock).mockReturnValue(updatedGame);
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (gameService.getPlayerView as Mock).mockReturnValue({
        id: testGameId,
        phase: 'playing',
        myHand: [],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId2,
      });

      mockClientSocket.emit('game:pickUpPile', {
        gameId: testGameId,
        playerId: testPlayerId1,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(gameService.pickUpPileAction).toHaveBeenCalledWith(testGameId, testPlayerId1);
      expect(mockServer.to).toHaveBeenCalledWith(testRoomId);
      expect(mockServer.emit).toHaveBeenCalledWith('game:turnChange', {
        activePlayerId: testPlayerId2,
      });
    });

    it('should emit error when pickup fails', async () => {
      (gameService.pickUpPileAction as Mock).mockImplementation(() => {
        throw new Error('Cannot pick up pile');
      });

      mockClientSocket.emit('game:pickUpPile', {
        gameId: testGameId,
        playerId: testPlayerId1,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Cannot pick up pile' });
    });

    it('should return early when room not found', async () => {
      const updatedGame = createMockGame({
        phase: 'playing',
        activePlayerId: testPlayerId2,
      });

      (gameService.pickUpPileAction as Mock).mockReturnValue(updatedGame);
      (gameService.getRoomIdFromGame as Mock).mockReturnValue(null);

      mockClientSocket.emit('game:pickUpPile', {
        gameId: testGameId,
        playerId: testPlayerId1,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not emit any events if no room
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should handle generic error with default message', async () => {
      (gameService.pickUpPileAction as Mock).mockImplementation(() => {
        throw { someProperty: 'not an Error' };
      });

      mockClientSocket.emit('game:pickUpPile', {
        gameId: testGameId,
        playerId: testPlayerId1,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Failed to pick up pile' });
    });
  });

  describe('broadcastGameState', () => {
    it('should send personalized state to each player', async () => {
      const mockGame = createMockGame({ phase: 'playing' });
      const socket1 = { data: { playerId: testPlayerId1 }, emit: vi.fn() };
      const socket2 = { data: { playerId: testPlayerId2 }, emit: vi.fn() };

      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (mockServer.in as Mock).mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([socket1, socket2]),
      });

      const player1View = {
        id: testGameId,
        phase: 'playing' as const,
        myHand: [{ rank: '3', suit: 'hearts' }],
        myFaceUp: [],
        myFaceDownCount: 3,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      };

      const player2View = {
        id: testGameId,
        phase: 'playing' as const,
        myHand: [{ rank: 'Q', suit: 'diamonds' }],
        myFaceUp: [],
        myFaceDownCount: 0,
        otherPlayers: {},
        pile: [],
        deckCount: 0,
        activePlayerId: testPlayerId1,
      };

      (gameService.getPlayerView as Mock)
        .mockReturnValueOnce(player1View)
        .mockReturnValueOnce(player2View);

      // Trigger any handler that calls broadcastGameState
      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: mockGame,
        blowUp: false,
        winner: false,
      });

      await mockSocket.clientMock.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: [{ rank: '3', suit: 'hearts' }],
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(socket1.emit).toHaveBeenCalledWith('game:stateUpdate', {
        gameState: player1View,
      });
      expect(socket2.emit).toHaveBeenCalledWith('game:stateUpdate', {
        gameState: player2View,
      });
    });

    it('should handle null player view gracefully', async () => {
      const mockGame = createMockGame({ phase: 'playing' });
      const socket1 = { data: { playerId: testPlayerId1 }, emit: vi.fn() };

      (gameService.getRoomIdFromGame as Mock).mockReturnValue(testRoomId);
      (mockServer.in as Mock).mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue([socket1]),
      });

      (gameService.getPlayerView as Mock).mockReturnValue(null);
      (gameService.playCardsAction as Mock).mockReturnValue({
        gameState: mockGame,
        blowUp: false,
        winner: false,
      });

      await mockSocket.clientMock.emit('game:playCards', {
        gameId: testGameId,
        playerId: testPlayerId1,
        cards: [{ rank: '3', suit: 'hearts' }],
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not emit if player view is null
      expect(socket1.emit).not.toHaveBeenCalled();
    });
  });

  describe('registerGameHandlers', () => {
    it('should register all game event handlers', () => {
      const socket = {
        on: vi.fn(),
        data: {},
      } as unknown as TypedSocket;

      registerGameHandlers(mockServer, socket);

      expect(socket.on).toHaveBeenCalledWith('game:selectFaceUp', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('game:playCards', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('game:pickUpPile', expect.any(Function));
      expect(socket.on).toHaveBeenCalledTimes(3);
    });
  });
});
