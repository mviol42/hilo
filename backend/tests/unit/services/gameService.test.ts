/**
 * Unit tests for GameService
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupGlobalMockRedis, resetMockRedis } from '../../testUtils/redisSetup';

describe('GameService', () => {
  let gameService: any;
  let lobbyService: any;
  let redisService: any;

  beforeAll(async () => {
    // Set up redis-mock globally before importing services
    await setupGlobalMockRedis();

    // Import services after redis is mocked
    const gameServiceModule = await import('../../../src/services/gameService');
    const lobbyServiceModule = await import('../../../src/services/lobbyService');
    const redisServiceModule = await import('../../../src/services/redisService');

    gameService = new gameServiceModule.GameService();
    lobbyService = new lobbyServiceModule.LobbyService();
    redisService = redisServiceModule.redisService;
  });

  beforeEach(async () => {
    // Reset redis data between tests
    await resetMockRedis(redisService);
  });

  describe('getPlayerView', () => {
    it('should include player names in the view', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Get player view
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify player names are included
      expect(playerView).toBeDefined();
      expect(playerView?.playerNames).toBeDefined();
      expect(playerView?.playerNames[player1Id]).toBe('Alice');
      expect(playerView?.playerNames[player2Id]).toBe('Bob');

      // Verify other players have names
      expect(playerView?.otherPlayers[player2Id]).toBeDefined();
      expect(playerView?.otherPlayers[player2Id].name).toBe('Bob');
    });

    it('should include winner name when game ends', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Manually set a winner (simulating game end)
      game.winner = player2Id;
      game.phase = 'ended';
      await gameService.updateGame(game.id, game);

      // Get player view
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify winner name is included
      expect(playerView).toBeDefined();
      expect(playerView?.winner).toBe(player2Id);
      expect(playerView?.winnerName).toBe('Bob');
    });

    it('should use fallback name when lobby is not found', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Delete the lobby to simulate lobby not found
      await redisService.deleteLobby(lobby.id);

      // Get player view
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify fallback names are used
      expect(playerView).toBeDefined();
      expect(playerView?.otherPlayers[player2Id]).toBeDefined();
      expect(playerView?.otherPlayers[player2Id].name).toBe(`Player ${player2Id.substring(0, 8)}`);
    });

    it('should not include current player in otherPlayers', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Get player view for player1
      const playerView = await gameService.getPlayerView(game.id, player1Id);

      // Verify player1 is not in otherPlayers
      expect(playerView).toBeDefined();
      expect(playerView?.otherPlayers[player1Id]).toBeUndefined();
      expect(playerView?.otherPlayers[player2Id]).toBeDefined();
    });

    it('should return null for non-existent game', async () => {
      const playerView = await gameService.getPlayerView('non-existent-game-id', uuidv4());
      expect(playerView).toBeNull();
    });

    it('should return null for non-existent player', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Try to get view for non-existent player
      const playerView = await gameService.getPlayerView(game.id, uuidv4());
      expect(playerView).toBeNull();
    });

    it('should include lastAction in player view', async () => {
      // Create lobby with players
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      // Create game
      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Set up game for playing
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [];

      // Give player1 a card to play
      const playerState = game.players.get(player1Id)!;
      playerState.hand = [{ rank: '5', suit: 'hearts' }];
      playerState.faceUp = [];
      playerState.faceDown = [];
      await gameService.updateGame(game.id, game);

      // Play the card
      const result = await gameService.playCardsAction(
        game.id,
        player1Id,
        'Alice',
        [{ rank: '5', suit: 'hearts' }]
      );

      // Verify lastAction was set on the returned gameState
      expect(result.gameState.lastAction).toBeDefined();
      expect(result.gameState.lastAction?.type).toBe('play_cards');
      expect(result.gameState.lastAction?.playerId).toBe(player1Id);
      expect(result.gameState.lastAction?.playerName).toBe('Alice');
      expect(result.gameState.lastAction?.cards).toHaveLength(1);
      expect(result.gameState.lastAction?.cards?.[0].rank).toBe('5');

      // Verify lastAction is included in player view
      const playerView = await gameService.getPlayerView(game.id, player2Id);
      expect(playerView?.lastAction).toBeDefined();
      expect(playerView?.lastAction?.type).toBe('play_cards');
      expect(playerView?.lastAction?.playerName).toBe('Alice');
    });
  });

  describe('playCardsAction', () => {
    it('should set lastAction with play_cards type for normal play', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Set up game
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [];

      const playerState = game.players.get(player1Id)!;
      playerState.hand = [{ rank: '7', suit: 'diamonds' }];
      playerState.faceUp = [];
      playerState.faceDown = [];
      await gameService.updateGame(game.id, game);

      // Play the card
      const result = await gameService.playCardsAction(
        game.id,
        player1Id,
        'Alice',
        [{ rank: '7', suit: 'diamonds' }]
      );

      expect(result.gameState.lastAction).toBeDefined();
      expect(result.gameState.lastAction?.type).toBe('play_cards');
      expect(result.gameState.lastAction?.playerId).toBe(player1Id);
      expect(result.gameState.lastAction?.playerName).toBe('Alice');
      expect(result.gameState.lastAction?.cards).toEqual([{ rank: '7', suit: 'diamonds' }]);
      expect(result.gameState.lastAction?.blowUpReason).toBeUndefined();
      expect(result.gameState.lastAction?.timestamp).toBeDefined();
    });

    it('should set lastAction with blow_up type for playing a 10', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Set up game with some cards on pile
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [{ rank: '5', suit: 'hearts' }];

      const playerState = game.players.get(player1Id)!;
      playerState.hand = [{ rank: '10', suit: 'spades' }];
      playerState.faceUp = [];
      playerState.faceDown = [];
      await gameService.updateGame(game.id, game);

      // Play the 10 card (causes blow up)
      const result = await gameService.playCardsAction(
        game.id,
        player1Id,
        'Alice',
        [{ rank: '10', suit: 'spades' }]
      );

      expect(result.blowUp).toBe(true);
      expect(result.gameState.lastAction).toBeDefined();
      expect(result.gameState.lastAction?.type).toBe('blow_up');
      expect(result.gameState.lastAction?.blowUpReason).toBe('ten');
      expect(result.gameState.lastAction?.cards).toEqual([{ rank: '10', suit: 'spades' }]);
    });

    it('should set lastAction with blow_up type for completing four of a kind', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Set up game with 3 sevens on pile
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [
        { rank: '7', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
        { rank: '7', suit: 'clubs' },
      ];

      const playerState = game.players.get(player1Id)!;
      playerState.hand = [{ rank: '7', suit: 'spades' }];
      playerState.faceUp = [];
      playerState.faceDown = [];
      await gameService.updateGame(game.id, game);

      // Play the 4th 7 (causes four of a kind blow up)
      const result = await gameService.playCardsAction(
        game.id,
        player1Id,
        'Alice',
        [{ rank: '7', suit: 'spades' }]
      );

      expect(result.blowUp).toBe(true);
      expect(result.gameState.lastAction).toBeDefined();
      expect(result.gameState.lastAction?.type).toBe('blow_up');
      expect(result.gameState.lastAction?.blowUpReason).toBe('four_of_kind');
    });

    it('should set pickedUpPile flag when facedown card causes pickup', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Set up game with a high card on pile
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [{ rank: 'K', suit: 'spades' }];

      const playerState = game.players.get(player1Id)!;
      playerState.hand = [];
      playerState.faceUp = [];
      playerState.faceDown = [{ rank: '3', suit: 'hearts' }]; // Can't play on K
      await gameService.updateGame(game.id, game);

      // Play the face-down card (will cause pickup)
      const result = await gameService.playCardsAction(
        game.id,
        player1Id,
        'Alice',
        [],
        0
      );

      expect(result.pickedUpPile).toBe(true);
      expect(result.gameState.lastAction).toBeDefined();
      expect(result.gameState.lastAction?.type).toBe('pickup_pile');
      expect(result.gameState.lastAction?.pickedUpCount).toBeGreaterThan(0);
    });
  });

  describe('pickUpPileAction', () => {
    it('should set lastAction with pickup_pile type', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id]);

      // Set up game with a high card on pile that player can't play on
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [{ rank: 'K', suit: 'spades' }]; // High card

      const playerState = game.players.get(player1Id)!;
      // Player has a 5 which can't be played on K (must be K or higher, or special cards)
      playerState.hand = [{ rank: '5', suit: 'hearts' }];
      playerState.faceUp = [];
      playerState.faceDown = [];
      await gameService.updateGame(game.id, game);

      // Pick up the pile (allowed because 5 can't be played on K)
      const result = await gameService.pickUpPileAction(game.id, player1Id, 'Alice');

      expect(result.lastAction).toBeDefined();
      expect(result.lastAction?.type).toBe('pickup_pile');
      expect(result.lastAction?.playerId).toBe(player1Id);
      expect(result.lastAction?.playerName).toBe('Alice');
      expect(result.lastAction?.pickedUpCount).toBe(1);
    });
  });

  describe('Multi-player lastAction scenarios', () => {
    it('should include lastAction in all player views after a play (3 players)', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();
      const player3Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');
      await lobbyService.joinLobby(lobby.id, player3Id, 'Charlie');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id, player3Id]);

      // Set up game
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [];

      const p1State = game.players.get(player1Id)!;
      p1State.hand = [{ rank: '5', suit: 'hearts' }];
      p1State.faceUp = [];
      p1State.faceDown = [];

      const p2State = game.players.get(player2Id)!;
      p2State.hand = [{ rank: '6', suit: 'diamonds' }];
      p2State.faceUp = [];
      p2State.faceDown = [];

      const p3State = game.players.get(player3Id)!;
      p3State.hand = [{ rank: '7', suit: 'clubs' }];
      p3State.faceUp = [];
      p3State.faceDown = [];

      await gameService.updateGame(game.id, game);

      // Player 1 plays
      await gameService.playCardsAction(game.id, player1Id, 'Alice', [{ rank: '5', suit: 'hearts' }]);

      // All players should see the same lastAction
      const view1 = await gameService.getPlayerView(game.id, player1Id);
      const view2 = await gameService.getPlayerView(game.id, player2Id);
      const view3 = await gameService.getPlayerView(game.id, player3Id);

      // All views should have lastAction
      expect(view1?.lastAction).toBeDefined();
      expect(view2?.lastAction).toBeDefined();
      expect(view3?.lastAction).toBeDefined();

      // All should show Alice played
      expect(view1?.lastAction?.playerName).toBe('Alice');
      expect(view2?.lastAction?.playerName).toBe('Alice');
      expect(view3?.lastAction?.playerName).toBe('Alice');

      // All should show the same cards
      expect(view1?.lastAction?.cards).toEqual([{ rank: '5', suit: 'hearts' }]);
      expect(view2?.lastAction?.cards).toEqual([{ rank: '5', suit: 'hearts' }]);
      expect(view3?.lastAction?.cards).toEqual([{ rank: '5', suit: 'hearts' }]);
    });

    it('should correctly attribute player name in 4-player game', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();
      const player3Id = uuidv4();
      const player4Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');
      await lobbyService.joinLobby(lobby.id, player3Id, 'Charlie');
      await lobbyService.joinLobby(lobby.id, player4Id, 'Diana');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id, player3Id, player4Id]);

      // Set up game with player 3 as active
      game.phase = 'playing';
      game.activePlayerId = player3Id;
      game.deck = [];
      game.pile = [];

      for (const [pid, state] of game.players) {
        state.hand = [{ rank: '5', suit: 'hearts' }];
        state.faceUp = [];
        state.faceDown = [];
      }
      await gameService.updateGame(game.id, game);

      // Player 3 (Charlie) plays
      await gameService.playCardsAction(game.id, player3Id, 'Charlie', [{ rank: '5', suit: 'hearts' }]);

      // Check from player 1's perspective (a different player)
      const view1 = await gameService.getPlayerView(game.id, player1Id);

      expect(view1?.lastAction).toBeDefined();
      expect(view1?.lastAction?.playerName).toBe('Charlie');
      expect(view1?.lastAction?.playerId).toBe(player3Id);
    });

    it('should show blow-up to all players in 3-player game', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();
      const player3Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');
      await lobbyService.joinLobby(lobby.id, player3Id, 'Charlie');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id, player3Id]);

      // Set up game with player 2 about to blow up
      game.phase = 'playing';
      game.activePlayerId = player2Id;
      game.deck = [];
      game.pile = [{ rank: '5', suit: 'hearts' }]; // Something on pile to blow up

      const p1State = game.players.get(player1Id)!;
      p1State.hand = [{ rank: '6', suit: 'diamonds' }];
      p1State.faceUp = [];
      p1State.faceDown = [];

      const p2State = game.players.get(player2Id)!;
      p2State.hand = [{ rank: '10', suit: 'spades' }]; // 10 will blow up
      p2State.faceUp = [];
      p2State.faceDown = [];

      const p3State = game.players.get(player3Id)!;
      p3State.hand = [{ rank: '7', suit: 'clubs' }];
      p3State.faceUp = [];
      p3State.faceDown = [];

      await gameService.updateGame(game.id, game);

      // Player 2 plays 10 (causes blow-up)
      const result = await gameService.playCardsAction(game.id, player2Id, 'Bob', [{ rank: '10', suit: 'spades' }]);

      expect(result.blowUp).toBe(true);

      // All players should see the blow-up
      const view1 = await gameService.getPlayerView(game.id, player1Id);
      const view2 = await gameService.getPlayerView(game.id, player2Id);
      const view3 = await gameService.getPlayerView(game.id, player3Id);

      expect(view1?.lastAction?.type).toBe('blow_up');
      expect(view2?.lastAction?.type).toBe('blow_up');
      expect(view3?.lastAction?.type).toBe('blow_up');

      expect(view1?.lastAction?.blowUpReason).toBe('ten');
      expect(view2?.lastAction?.blowUpReason).toBe('ten');
      expect(view3?.lastAction?.blowUpReason).toBe('ten');

      expect(view1?.lastAction?.playerName).toBe('Bob');
      expect(view2?.lastAction?.playerName).toBe('Bob');
      expect(view3?.lastAction?.playerName).toBe('Bob');
    });

    it('should show four-of-kind blow-up to all players in 4-player game', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();
      const player3Id = uuidv4();
      const player4Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');
      await lobbyService.joinLobby(lobby.id, player3Id, 'Charlie');
      await lobbyService.joinLobby(lobby.id, player4Id, 'Diana');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id, player3Id, player4Id]);

      // Set up game with 3 sevens on pile, player 4 about to complete four-of-kind
      game.phase = 'playing';
      game.activePlayerId = player4Id;
      game.deck = [];
      game.pile = [
        { rank: '7', suit: 'hearts' },
        { rank: '7', suit: 'diamonds' },
        { rank: '7', suit: 'clubs' },
      ];

      for (const [pid, state] of game.players) {
        state.hand = [{ rank: '5', suit: 'hearts' }];
        state.faceUp = [];
        state.faceDown = [];
      }

      // Give player 4 the 4th seven
      const p4State = game.players.get(player4Id)!;
      p4State.hand = [{ rank: '7', suit: 'spades' }];

      await gameService.updateGame(game.id, game);

      // Player 4 plays the 4th seven
      const result = await gameService.playCardsAction(game.id, player4Id, 'Diana', [{ rank: '7', suit: 'spades' }]);

      expect(result.blowUp).toBe(true);

      // All players should see the four-of-kind blow-up
      const view1 = await gameService.getPlayerView(game.id, player1Id);
      const view2 = await gameService.getPlayerView(game.id, player2Id);
      const view3 = await gameService.getPlayerView(game.id, player3Id);
      const view4 = await gameService.getPlayerView(game.id, player4Id);

      expect(view1?.lastAction?.type).toBe('blow_up');
      expect(view1?.lastAction?.blowUpReason).toBe('four_of_kind');
      expect(view1?.lastAction?.playerName).toBe('Diana');

      expect(view2?.lastAction?.type).toBe('blow_up');
      expect(view3?.lastAction?.type).toBe('blow_up');
      expect(view4?.lastAction?.type).toBe('blow_up');
    });

    it('should show pickup to all players when player picks up pile (3 players)', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();
      const player3Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');
      await lobbyService.joinLobby(lobby.id, player3Id, 'Charlie');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id, player3Id]);

      // Set up game with player 2 needing to pick up
      game.phase = 'playing';
      game.activePlayerId = player2Id;
      game.deck = [];
      game.pile = [
        { rank: 'K', suit: 'spades' },
        { rank: 'A', suit: 'hearts' },
      ]; // High cards

      const p1State = game.players.get(player1Id)!;
      p1State.hand = [{ rank: '6', suit: 'diamonds' }];
      p1State.faceUp = [];
      p1State.faceDown = [];

      const p2State = game.players.get(player2Id)!;
      p2State.hand = [{ rank: '5', suit: 'clubs' }]; // Can't play on K/A
      p2State.faceUp = [];
      p2State.faceDown = [];

      const p3State = game.players.get(player3Id)!;
      p3State.hand = [{ rank: '7', suit: 'hearts' }];
      p3State.faceUp = [];
      p3State.faceDown = [];

      await gameService.updateGame(game.id, game);

      // Player 2 picks up the pile
      await gameService.pickUpPileAction(game.id, player2Id, 'Bob');

      // All players should see the pickup
      const view1 = await gameService.getPlayerView(game.id, player1Id);
      const view2 = await gameService.getPlayerView(game.id, player2Id);
      const view3 = await gameService.getPlayerView(game.id, player3Id);

      expect(view1?.lastAction?.type).toBe('pickup_pile');
      expect(view2?.lastAction?.type).toBe('pickup_pile');
      expect(view3?.lastAction?.type).toBe('pickup_pile');

      expect(view1?.lastAction?.playerName).toBe('Bob');
      expect(view2?.lastAction?.playerName).toBe('Bob');
      expect(view3?.lastAction?.playerName).toBe('Bob');

      expect(view1?.lastAction?.pickedUpCount).toBe(2);
      expect(view2?.lastAction?.pickedUpCount).toBe(2);
      expect(view3?.lastAction?.pickedUpCount).toBe(2);
    });

    it('should update lastAction on each turn in sequence (3 players)', async () => {
      const lobby = await lobbyService.createLobby();
      const player1Id = uuidv4();
      const player2Id = uuidv4();
      const player3Id = uuidv4();

      await lobbyService.joinLobby(lobby.id, player1Id, 'Alice');
      await lobbyService.joinLobby(lobby.id, player2Id, 'Bob');
      await lobbyService.joinLobby(lobby.id, player3Id, 'Charlie');

      const game = await gameService.createGame(lobby.id, [player1Id, player2Id, player3Id]);

      // Set up game - use 2s which can always be played (reset card)
      game.phase = 'playing';
      game.activePlayerId = player1Id;
      game.deck = [];
      game.pile = [];

      const p1State = game.players.get(player1Id)!;
      p1State.hand = [{ rank: '2', suit: 'hearts' }, { rank: '3', suit: 'diamonds' }];
      p1State.faceUp = [];
      p1State.faceDown = [];

      const p2State = game.players.get(player2Id)!;
      p2State.hand = [{ rank: '2', suit: 'clubs' }, { rank: '4', suit: 'spades' }];
      p2State.faceUp = [];
      p2State.faceDown = [];

      const p3State = game.players.get(player3Id)!;
      p3State.hand = [{ rank: '2', suit: 'spades' }, { rank: '5', suit: 'diamonds' }];
      p3State.faceUp = [];
      p3State.faceDown = [];

      await gameService.updateGame(game.id, game);

      // Turn 1: Alice plays a 2
      await gameService.playCardsAction(game.id, player1Id, 'Alice', [{ rank: '2', suit: 'hearts' }]);

      let viewFromP3 = await gameService.getPlayerView(game.id, player3Id);
      expect(viewFromP3?.lastAction?.playerName).toBe('Alice');
      expect(viewFromP3?.lastAction?.cards).toEqual([{ rank: '2', suit: 'hearts' }]);

      // Turn 2: Bob plays a 2 (2 can always be played)
      const gameAfterT1 = await gameService.getGame(game.id);
      gameAfterT1!.activePlayerId = player2Id;
      await gameService.updateGame(game.id, gameAfterT1!);

      await gameService.playCardsAction(game.id, player2Id, 'Bob', [{ rank: '2', suit: 'clubs' }]);

      viewFromP3 = await gameService.getPlayerView(game.id, player3Id);
      expect(viewFromP3?.lastAction?.playerName).toBe('Bob');
      expect(viewFromP3?.lastAction?.cards).toEqual([{ rank: '2', suit: 'clubs' }]);

      // Turn 3: Charlie plays a 2
      const gameAfterT2 = await gameService.getGame(game.id);
      gameAfterT2!.activePlayerId = player3Id;
      await gameService.updateGame(game.id, gameAfterT2!);

      await gameService.playCardsAction(game.id, player3Id, 'Charlie', [{ rank: '2', suit: 'spades' }]);

      const viewFromP1 = await gameService.getPlayerView(game.id, player1Id);
      expect(viewFromP1?.lastAction?.playerName).toBe('Charlie');
      expect(viewFromP1?.lastAction?.cards).toEqual([{ rank: '2', suit: 'spades' }]);
    });

    it('should handle 5-player game with correct lastAction', async () => {
      const lobby = await lobbyService.createLobby();
      const playerIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()];
      const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];

      for (let i = 0; i < 5; i++) {
        await lobbyService.joinLobby(lobby.id, playerIds[i], playerNames[i]);
      }

      const game = await gameService.createGame(lobby.id, playerIds, 'standard');

      // Set up game with player 5 (Eve) as active
      game.phase = 'playing';
      game.activePlayerId = playerIds[4]; // Eve
      game.deck = [];
      game.pile = [];

      for (const [pid, state] of game.players) {
        state.hand = [{ rank: '5', suit: 'hearts' }];
        state.faceUp = [];
        state.faceDown = [];
      }
      await gameService.updateGame(game.id, game);

      // Eve plays
      await gameService.playCardsAction(game.id, playerIds[4], 'Eve', [{ rank: '5', suit: 'hearts' }]);

      // Check all 5 players can see the lastAction
      for (let i = 0; i < 5; i++) {
        const view = await gameService.getPlayerView(game.id, playerIds[i]);
        expect(view?.lastAction).toBeDefined();
        expect(view?.lastAction?.playerName).toBe('Eve');
        expect(view?.lastAction?.playerId).toBe(playerIds[4]);
        expect(view?.lastAction?.type).toBe('play_cards');
      }
    });
  });
});
