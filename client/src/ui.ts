import chalk from 'chalk';
import { Card } from '@hilo/shared/types/card';
import { PlayerView, GamePhase } from '@hilo/shared/types/game';
import { LobbyState } from '@hilo/shared/types/lobby';

export class UI {
  clear(): void {
    console.clear();
  }

  header(text: string): void {
    console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan(text.toUpperCase().padStart((60 + text.length) / 2)));
    console.log(chalk.bold.cyan('='.repeat(60) + '\n'));
  }

  section(text: string): void {
    console.log(chalk.bold.yellow(`\n${text}`));
    console.log(chalk.yellow('-'.repeat(text.length)));
  }

  info(text: string): void {
    console.log(chalk.blue(`ℹ ${text}`));
  }

  success(text: string): void {
    console.log(chalk.green(`✓ ${text}`));
  }

  error(text: string): void {
    console.log(chalk.red(`✗ ${text}`));
  }

  warning(text: string): void {
    console.log(chalk.yellow(`⚠ ${text}`));
  }

  formatCard(card: Card): string {
    const suitSymbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    };

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const cardText = `${card.rank}${suitSymbols[card.suit]}`;

    return isRed ? chalk.red(cardText) : chalk.white(cardText);
  }

  formatCards(cards: Card[]): string {
    if (cards.length === 0) return chalk.gray('(empty)');
    return cards.map(c => `[${this.formatCard(c)}]`).join(' ');
  }

  showLobby(lobby: LobbyState, playerId: string): void {
    this.clear();
    this.header('Lobby');

    this.info(`Lobby ID: ${chalk.bold(lobby.id)}`);
    this.info(`Status: ${chalk.bold(lobby.status)}`);
    console.log();

    this.section('Players');
    Array.from(lobby.players.values()).forEach((player) => {
      const isYou = player.id === playerId;
      const isLeader = player.id === lobby.leaderId;
      const prefix = isLeader ? '👑' : '  ';
      const suffix = isYou ? chalk.cyan(' (you)') : '';
      const isReady = player.isReady ? ' ✅' : ''
      console.log(`${prefix} ${player.name}${suffix}${isReady}`);
    });

    console.log();
    if (lobby.leaderId === playerId) {
      this.info('You are the leader. Type "start" to begin the game.');
    } else {
      this.info('Waiting for the leader to start the game...');
    }
  }

  showGameState(gameState: PlayerView, playerId: string): void {
    this.clear();
    this.header('Hi-Lo Card Game');

    if (gameState.phase === 'setup') {
      this.section('Setup Phase');
      this.info('Select 3 cards from your hand to place face-up');
      console.log();
    }

    this.section('Your Cards');
    console.log(`Hand:        ${this.formatCards(gameState.myHand)}`);
    console.log(`Face-Up:     ${this.formatCards(gameState.myFaceUp)}`);
    console.log(`Face-Down:   ${chalk.gray(`${gameState.myFaceDownCount} card(s)`)}`);
    console.log();

    this.section('Table');
    console.log(`Deck:        ${chalk.gray(`${gameState.deckCount} card(s)`)}`);
    console.log(`Pile:        ${this.formatCards(gameState.pile)}`);
    console.log();

    this.section('Other Players');
    Object.entries(gameState.otherPlayers).forEach(([pid, playerState]) => {
      const isActive = gameState.activePlayerId === pid;
      const marker = isActive ? chalk.yellow('▶') : ' ';
      console.log(`${marker} Player ${pid.substring(0, 8)}...`);
      console.log(`  Hand:      ${chalk.gray(`${playerState.handCount} card(s)`)}`);
      console.log(`  Face-Up:   ${this.formatCards(playerState.faceUp)}`);
      console.log(`  Face-Down: ${chalk.gray(`${playerState.faceDownCount} card(s)`)}`);
    });

    console.log();

    const isMyTurn = gameState.activePlayerId === playerId;
    if (isMyTurn) {
      this.success('It\'s your turn!');
      if (gameState.playableCards && gameState.playableCards.length > 0) {
        this.info(`Playable cards: ${this.formatCards(gameState.playableCards)}`);
      } else if (gameState.phase === 'playing') {
        this.warning('No playable cards - you must pick up the pile');
      }
    } else {
      const activeMarker = chalk.yellow('⏳');
      this.info(`${activeMarker} Waiting for Player ${gameState.activePlayerId.substring(0, 8)}... to play`);
    }

    console.log();
  }

  showWinner(winnerName: string, isYou: boolean): void {
    this.clear();
    this.header('Game Over!');
    console.log();

    if (isYou) {
      console.log(chalk.green.bold('🎉 CONGRATULATIONS! YOU WON! 🎉'));
    } else {
      console.log(chalk.yellow(`👏 ${winnerName} wins! Better luck next time.`));
    }

    console.log();
  }

  prompt(message: string): void {
    process.stdout.write(chalk.cyan(`\n${message}: `));
  }
}
