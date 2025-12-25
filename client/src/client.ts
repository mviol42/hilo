import { ApiClient } from './api';
import { SocketClient } from './socket';
import { GameStateManager } from './gameState';
import { UI } from './ui';
import { InputHandler } from './input';
import { Card } from '@hilo/shared/types/card';

export class GameClient {
  private api: ApiClient;
  private socket: SocketClient;
  private state: GameStateManager;
  private ui: UI;
  private input: InputHandler;
  private isRunning: boolean = false;

  constructor(serverURL: string = 'http://localhost:3000') {
    this.api = new ApiClient(serverURL);
    this.socket = new SocketClient(serverURL);
    this.state = new GameStateManager();
    this.ui = new UI();
    this.input = new InputHandler();

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.socket.on('lobby:playerJoined', (data) => {
      this.state.updateLobby(data.lobby);
      const currentState = this.state.getState();
      if (currentState.phase === 'lobby' && currentState.playerId) {
        this.ui.showLobby(data.lobby, currentState.playerId);
        this.ui.success(`${data.player.name} joined the lobby`);
      }
    });

    this.socket.on('lobby:playerLeft', (data) => {
      this.state.updateLobby(data.lobby);
      const currentState = this.state.getState();
      if (currentState.phase === 'lobby' && currentState.playerId) {
        this.ui.showLobby(data.lobby, currentState.playerId);
        this.ui.warning(`Player ${data.playerId.substring(0, 8)}... left the lobby`);
      }
    });

    this.socket.on('lobby:leaderChanged', (data) => {
      this.state.updateLobby(data.lobby);
      const currentState = this.state.getState();
      const isNewLeader = data.newLeaderId === currentState.playerId;
      this.state.updateLeader(isNewLeader);

      if (currentState.phase === 'lobby' && currentState.playerId) {
        this.ui.showLobby(data.lobby, currentState.playerId);
        if (isNewLeader) {
          this.ui.success('You are now the leader!');
        }
      }
    });

    this.socket.on('lobby:gameStarting', (data) => {
      this.state.startGame(data.gameId);
      this.ui.success(`Game starting! Game ID: ${data.gameId}`);
    });

    this.socket.on('game:stateUpdate', (data) => {
      this.state.updateGameState(data.gameState);
      const currentState = this.state.getState();

      if (currentState.phase === 'game' && currentState.playerId && currentState.gameState) {
        this.ui.showGameState(currentState.gameState, currentState.playerId);
      }
    });

    this.socket.on('game:turnChange', (data) => {
      const currentState = this.state.getState();
      if (currentState.phase === 'game' && currentState.playerId) {
        const isMyTurn = data.activePlayerId === currentState.playerId;
        if (isMyTurn) {
          this.ui.info('Your turn!');
        }
      }
    });

    this.socket.on('game:pileBlown', (data) => {
      const reason = data.reason === 'ten' ? 'played a 10' : 'got 4-of-a-kind';
      this.ui.success(`💥 Pile blown! Player ${data.playerId.substring(0, 8)}... ${reason}`);
    });

    this.socket.on('game:playerWon', (data) => {
      const currentState = this.state.getState();
      const isYou = data.winnerId === currentState.playerId;
      this.state.setWinner(data.winnerId, data.winnerName);
      this.ui.showWinner(data.winnerName, isYou);
    });

    this.socket.on('error', (data) => {
      this.ui.error(data.message);
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.ui.clear();
    this.ui.header('Welcome to Hi-Lo Card Game');

    try {
      const playerName = await this.input.getPlayerName();

      await this.showMainMenu(playerName);
    } catch (error) {
      if (error instanceof Error) {
        this.ui.error(`Error: ${error.message}`);
      }
    } finally {
      this.cleanup();
    }
  }

  private async showMainMenu(playerName: string): Promise<void> {
    while (this.isRunning) {
      const choice = await this.input.getMenuChoice();

      if (choice === 'quit') {
        this.ui.info('Goodbye!');
        break;
      }

      try {
        await this.socket.connect();
        this.ui.success('Connected to server');

        if (choice === 'create') {
          await this.createLobby(playerName);
        } else if (choice === 'join') {
          await this.joinLobby(playerName);
        }
      } catch (error) {
        if (error instanceof Error) {
          this.ui.error(`Connection failed: ${error.message}`);
        }
        continue;
      }
    }
  }

  private async createLobby(playerName: string): Promise<void> {
    const { lobbyId } = await this.api.createLobby();
    this.ui.success(`Lobby created! ID: ${lobbyId}`);

    await this.joinLobbyFlow(lobbyId, playerName);
  }

  private async joinLobby(playerName: string): Promise<void> {
    const lobbyId = await this.input.getLobbyId();
    await this.joinLobbyFlow(lobbyId, playerName);
  }

  private async joinLobbyFlow(lobbyId: string, playerName: string): Promise<void> {
    const { playerId, isLeader, lobby } = await this.api.joinLobby(lobbyId, playerName);
    this.state.setLobby(lobbyId, playerId, playerName, isLeader, lobby);

    this.ui.showLobby(lobby, playerId);

    await this.lobbyLoop();
  }

  private async lobbyLoop(): Promise<void> {
    const currentState = this.state.getState();

    if (!currentState.lobbyId || !currentState.playerId) {
      throw new Error('Invalid state: not in a lobby');
    }

    while (currentState.phase === 'lobby') {
      const command = await this.input.question('\nCommand (start/leave)');

      if (command === 'leave') {
        await this.api.leaveLobby(currentState.lobbyId, currentState.playerId);
        this.state.reset();
        break;
      } else if (command === 'start') {
        if (!currentState.isLeader) {
          this.ui.warning('Only the leader can start the game');
          continue;
        }

        if (currentState.lobby && currentState.lobby.players.length < 2) {
          this.ui.warning('Need at least 2 players to start');
          continue;
        }

        try {
          await this.api.startGame(currentState.lobbyId, currentState.playerId);
          this.ui.success('Starting game...');

          await this.gameLoop();
          break;
        } catch (error) {
          if (error instanceof Error) {
            this.ui.error(`Failed to start game: ${error.message}`);
          }
        }
      }
    }
  }

  private async gameLoop(): Promise<void> {
    const currentState = this.state.getState();

    if (!currentState.gameId || !currentState.playerId) {
      throw new Error('Invalid state: not in a game');
    }

    while (currentState.phase === 'game' || currentState.phase === 'ended') {
      if (currentState.phase === 'ended') {
        await this.input.question('\nPress Enter to return to menu');
        this.state.reset();
        this.socket.disconnect();
        break;
      }

      const gameState = currentState.gameState;
      if (!gameState) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      if (gameState.phase === 'setup') {
        await this.setupPhase(currentState.gameId, currentState.playerId, gameState);
      } else if (gameState.phase === 'playing') {
        await this.playingPhase(currentState.gameId, currentState.playerId, gameState);
      }
    }
  }

  private async setupPhase(gameId: string, playerId: string, gameState: any): Promise<void> {
    if (gameState.myFaceUp.length === 3) {
      this.ui.info('Waiting for other players to select their face-up cards...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    this.ui.info('Select 3 cards to place face-up (enter indices separated by spaces, e.g., "0 1 2"):');

    gameState.myHand.forEach((card: Card, index: number) => {
      console.log(`  ${index}: ${this.ui.formatCard(card)}`);
    });

    try {
      const input = await this.input.question('\nYour selection');
      const indices = await this.input.parseCardIndices(input, gameState.myHand.length);

      if (indices.length !== 3) {
        this.ui.error('You must select exactly 3 cards');
        return;
      }

      const selectedCards = indices.map(i => gameState.myHand[i]);
      await this.api.selectFaceUp(gameId, playerId, selectedCards);
      this.ui.success('Face-up cards selected!');
    } catch (error) {
      if (error instanceof Error) {
        this.ui.error(error.message);
      }
    }
  }

  private async playingPhase(gameId: string, playerId: string, gameState: any): Promise<void> {
    if (gameState.activePlayerId !== playerId) {
      this.ui.info('Waiting for your turn...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }

    const command = await this.input.question('\nCommand (play/pickup)');

    if (command === 'pickup') {
      await this.api.pickUpPile(gameId, playerId);
      this.ui.info('Picking up the pile...');
    } else if (command === 'play') {
      await this.playCardsPhase(gameId, playerId, gameState);
    } else {
      this.ui.warning('Invalid command. Use "play" or "pickup"');
    }
  }

  private async playCardsPhase(gameId: string, playerId: string, gameState: any): Promise<void> {
    const availableCards = this.getAvailableCards(gameState);

    if (availableCards.length === 0) {
      this.ui.error('No cards available to play');
      return;
    }

    this.ui.info('Available cards:');
    availableCards.forEach((card: Card, index: number) => {
      console.log(`  ${index}: ${this.ui.formatCard(card)}`);
    });

    try {
      const input = await this.input.question('\nSelect card(s) to play (indices separated by spaces)');
      const indices = await this.input.parseCardIndices(input, availableCards.length);

      if (indices.length === 0) {
        this.ui.error('You must select at least one card');
        return;
      }

      const selectedCards = indices.map(i => availableCards[i]);
      await this.api.playCards(gameId, playerId, selectedCards);
      this.ui.success('Cards played!');
    } catch (error) {
      if (error instanceof Error) {
        this.ui.error(error.message);
      }
    }
  }

  private getAvailableCards(gameState: any): Card[] {
    if (gameState.myHand.length > 0) {
      return gameState.myHand;
    } else if (gameState.myFaceUp.length > 0) {
      return gameState.myFaceUp;
    } else {
      return [];
    }
  }

  private cleanup(): void {
    this.socket.disconnect();
    this.input.close();
    this.isRunning = false;
  }

  stop(): void {
    this.isRunning = false;
    this.cleanup();
  }
}
