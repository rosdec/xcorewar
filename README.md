# Core War - Redcode Emulator (MARS)

A web-based implementation of Core War, the classic programming game where assembly programs battle for control of a virtual computer's memory.

## About Core War

Core War is a programming game created in 1984 by D. G. Jones and A. K. Dewdney. In this game, two or more battle programs (called "warriors") compete for control of a virtual computer called MARS (Memory Array Redcode Simulator). Written in an assembly language called Redcode, these warriors attempt to terminate each other by overwriting instructions, forcing opponents to execute illegal instructions, or spreading copies of themselves throughout the core memory.

The game runs in cycles, with each warrior's process executing one instruction per turn in a round-robin fashion. Victory is achieved when all of an opponent's processes have been terminated. The simplicity of the Redcode language belies the sophisticated strategies that emerge - from the minimal "Imp" that copies itself forward through memory, to complex scanners, bombers, and self-replicating programs.

### Key Concepts:

- **Core Memory**: A circular array of 8000 memory locations where warriors execute
- **Redcode**: Assembly-like language with opcodes like MOV, ADD, JMP, SPL, and DAT
- **Addressing Modes**: Immediate (#), Direct ($), and Indirect (@) addressing
- **Processes**: Each warrior can spawn multiple execution threads using the SPL instruction
- **Round-Robin Execution**: Warriors take turns executing one instruction per cycle

This implementation supports a simplified ICWS '94 Redcode subset, including classic warriors like "The Imp" (`MOV 0, 1`).

## Technology Stack

This project is built with modern web technologies:

- **[Fresh](https://fresh.deno.dev/)** - A next-generation web framework for Deno
- **[Deno](https://deno.com/)** - A modern, secure runtime for JavaScript and TypeScript
- **[Preact](https://preactjs.com/)** - Fast 3kB alternative to React with the same modern API
- **[Vite](https://vitejs.dev/)** - Lightning-fast frontend build tool
- **TypeScript** - Type-safe development experience
- **Tailwind CSS** - Utility-first CSS framework for styling

The Core War emulator is implemented as an interactive Preact island (`CoreWarGame.tsx`), providing a fully functional MARS simulator with real-time visualization of memory, processes, and execution cycles.

## Installation & Setup

### Prerequisites

Make sure you have Deno installed on your system:

**Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

For more installation options, visit: https://docs.deno.com/runtime/getting_started/installation

### Running the Game

1. **Clone or navigate to the project directory**

2. **Start the development server:**
   ```bash
   deno task dev
   ```

3. **Open your browser** and navigate to `http://localhost:5173` (or the URL shown in your terminal)

4. **Load a warrior** by entering Redcode in the text area and clicking "Load Warrior"

5. **Run the simulation** using the Run/Pause button, or step through execution one cycle at a time

### Example Warriors

Try these classic warriors:

**The Imp:**
```redcode
MOV 0, 1
```

**Dwarf:**
```redcode
ADD #4, 3
MOV 2, @2
JMP -2
DAT #0, #0
```

## Building for Production

To create an optimized production build:

```bash
deno task build
```

Then start the production server:

```bash
deno task start
```

## Available Commands

- `deno task dev` - Start development server with hot reload
- `deno task build` - Build for production
- `deno task start` - Start production server
- `deno task check` - Run formatter, linter, and type checker
- `deno task update` - Update Fresh framework

## Project Structure

```
xcorewar/
├── islands/
│   └── CoreWarGame.tsx    # Main Core War emulator component
├── routes/
│   ├── index.tsx          # Homepage route
│   └── _app.tsx           # App wrapper
├── components/            # Reusable UI components
├── static/                # Static assets
├── assets/
│   └── styles.css         # Global styles
├── main.ts                # Server entry point
├── deno.json             # Deno configuration & dependencies
└── vite.config.ts        # Vite configuration
```

## Learn More

- [Core War International](https://corewar.co.uk/) - History, documentation, and resources
- [Fresh Documentation](https://fresh.deno.dev/docs)
- [Deno Documentation](https://docs.deno.com/)

## License

This project is open source and available for educational purposes.
