import * as readline from 'readline';

export class InputHandler {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  close(): void {
    this.rl.close();
  }

  async getPlayerName(): Promise<string> {
    let name = '';
    while (!name) {
      name = await this.question('Enter your name: ');
      if (!name) {
        console.log('Name cannot be empty. Please try again.');
      }
    }
    return name;
  }

  async getMenuChoice(): Promise<'create' | 'join' | 'quit'> {
    while (true) {
      console.log('\n1. Create a new lobby');
      console.log('2. Join an existing lobby');
      console.log('3. Quit');
      const choice = await this.question('\nChoose an option (1-3): ');

      switch (choice) {
        case '1':
          return 'create';
        case '2':
          return 'join';
        case '3':
          return 'quit';
        default:
          console.log('Invalid choice. Please enter 1, 2, or 3.');
      }
    }
  }

  async getLobbyId(): Promise<string> {
    let lobbyId = '';
    while (!lobbyId) {
      lobbyId = await this.question('Enter lobby ID: ');
      if (!lobbyId) {
        console.log('Lobby ID cannot be empty. Please try again.');
      }
    }
    return lobbyId;
  }

  async parseCardIndices(input: string, maxIndex: number): Promise<number[]> {
    const parts = input.split(/[\s,]+/).filter(p => p);
    const indices: number[] = [];

    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num >= maxIndex) {
        throw new Error(`Invalid card index: ${part}`);
      }
      indices.push(num);
    }

    return indices;
  }
}
