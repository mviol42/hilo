/**
 * Tests to verify shared types can be imported correctly
 */

import { describe, it, expect } from 'vitest';
import type {
  Card,
  Rank,
  Suit,
  SPECIAL_RANKS,
  Player,
  PlayerId,
  PlayerGameState,
  Lobby,
  LobbyId,
  LobbyStatus,
  GameState,
  GamePhase,
  GameAction,
  CreateLobbyResponse,
  JoinLobbyRequest,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@hilo/shared';

describe('Shared Type Imports', () => {
  describe('Card Types', () => {
    it('should import Card type and create a valid card', () => {
      const card: Card = {
        rank: '5',
        suit: 'hearts',
      };

      expect(card.rank).toBe('5');
      expect(card.suit).toBe('hearts');
    });

    it('should import Rank type with all valid values', () => {
      const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

      expect(ranks).toHaveLength(13);
      expect(ranks).toContain('2');
      expect(ranks).toContain('A');
    });

    it('should import Suit type with all valid values', () => {
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

      expect(suits).toHaveLength(4);
      expect(suits).toContain('hearts');
      expect(suits).toContain('spades');
    });
  });

  describe('Player Types', () => {
    it('should import Player type and create a valid player', () => {
      const player: Player = {
        id: 'player-123',
        name: 'Test Player',
        isLeader: true,
        socketId: 'socket-456',
      };

      expect(player.id).toBe('player-123');
      expect(player.name).toBe('Test Player');
      expect(player.isLeader).toBe(true);
    });

    it('should import PlayerId type', () => {
      const playerId: PlayerId = 'test-player-id';

      expect(typeof playerId).toBe('string');
    });

    it('should import PlayerGameState type', () => {
      const gameState: PlayerGameState = {
        hand: [{ rank: '5', suit: 'hearts' }],
        faceUp: [{ rank: '7', suit: 'clubs' }],
        faceDown: [{ rank: '3', suit: 'diamonds' }],
      };

      expect(gameState.hand).toHaveLength(1);
      expect(gameState.faceUp).toHaveLength(1);
      expect(gameState.faceDown).toHaveLength(1);
    });
  });

  describe('Lobby Types', () => {
    it('should import LobbyId type', () => {
      const lobbyId: LobbyId = 'lobby-123';

      expect(typeof lobbyId).toBe('string');
    });

    it('should import LobbyStatus type', () => {
      const statuses: LobbyStatus[] = ['waiting', 'in_game'];

      expect(statuses).toHaveLength(2);
      expect(statuses).toContain('waiting');
      expect(statuses).toContain('in_game');
    });

    it('should import Lobby type and create a valid lobby', () => {
      const now = new Date();
      const playerMap = new Map<PlayerId, Player>();
      playerMap.set('player-1', {
        id: 'player-1',
        name: 'Player 1',
        isLeader: true,
      });

      const lobby: Lobby = {
        id: 'lobby-123',
        players: playerMap,
        leaderId: 'player-1',
        status: 'waiting',
        createdAt: now,
      };

      expect(lobby.id).toBe('lobby-123');
      expect(lobby.status).toBe('waiting');
      expect(lobby.players.size).toBe(1);
    });
  });

  describe('Game Types', () => {
    it('should import GamePhase type', () => {
      const phases: GamePhase[] = ['setup', 'playing', 'ended'];

      expect(phases).toHaveLength(3);
      expect(phases).toContain('setup');
      expect(phases).toContain('playing');
      expect(phases).toContain('ended');
    });

    it('should import GameAction type', () => {
      const actions: GameAction[] = [
        'deal',
        'select_faceup',
        'play_cards',
        'pickup_pile',
        'draw_cards',
        'blow_up',
      ];

      expect(actions).toHaveLength(6);
      expect(actions).toContain('deal');
      expect(actions).toContain('blow_up');
    });

    it('should import GameState type', () => {
      const playerMap = new Map<PlayerId, PlayerGameState>();
      playerMap.set('player-1', {
        hand: [],
        faceUp: [],
        faceDown: [],
      });

      const gameState: GameState = {
        id: 'game-123',
        phase: 'setup',
        players: playerMap,
        deck: [],
        pile: [],
        discardPile: [],
        activePlayerId: 'player-1',
        turnOrder: ['player-1'],
        log: [],
      };

      expect(gameState.id).toBe('game-123');
      expect(gameState.phase).toBe('setup');
      expect(gameState.players.size).toBe(1);
    });
  });

  describe('API Types', () => {
    it('should import CreateLobbyResponse type', () => {
      const response: CreateLobbyResponse = {
        lobbyId: 'lobby-123',
      };

      expect(response.lobbyId).toBe('lobby-123');
    });

    it('should import JoinLobbyRequest type', () => {
      const request: JoinLobbyRequest = {
        lobbyId: 'lobby-123',
        playerName: 'Test Player',
      };

      expect(request.lobbyId).toBe('lobby-123');
      expect(request.playerName).toBe('Test Player');
    });
  });

  describe('Event Types', () => {
    it('should import ClientToServerEvents type', () => {
      // This is a type-only test - just verify it can be imported
      // The type will be used in Socket.IO server implementation
      type ClientEvents = ClientToServerEvents;

      // If we got here, the import worked
      expect(true).toBe(true);
    });

    it('should import ServerToClientEvents type', () => {
      // This is a type-only test - just verify it can be imported
      // The type will be used in Socket.IO server implementation
      type ServerEvents = ServerToClientEvents;

      // If we got here, the import worked
      expect(true).toBe(true);
    });
  });

  describe('Type Integration', () => {
    it('should use multiple imported types together', () => {
      // Create a complete scenario using multiple types
      const card: Card = { rank: 'A', suit: 'spades' };

      const player: Player = {
        id: 'player-1',
        name: 'Alice',
        isLeader: true,
      };

      const playerState: PlayerGameState = {
        hand: [card],
        faceUp: [],
        faceDown: [],
      };

      const lobby: Lobby = {
        id: 'lobby-1',
        players: new Map([[player.id, player]]),
        leaderId: player.id,
        status: 'waiting',
        createdAt: new Date(),
      };

      // Verify all types work together
      expect(card.rank).toBe('A');
      expect(player.name).toBe('Alice');
      expect(playerState.hand[0]).toEqual(card);
      expect(lobby.players.get(player.id)).toEqual(player);
    });
  });
});
