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

## Differences from official ICWS '94 / Redcode

This project implements a simplified, practical subset of the ICWS '94 Redcode language to make an interactive web-based MARS easier to understand and extend. The emulator aims to be educational and functional for classic examples (Imp, Dwarf, simple scanners), but it is not a full, strict ICWS '94 implementation. Important differences you should know about:

- Supported opcodes: only a core subset is implemented: `DAT`, `MOV`, `ADD`, `SUB`, `JMP`, `SPL`, and `NOP`.
   - The official specification includes many more instructions (for example: `JMZ`, `JMN`, `SEQ`, `SNE`, `SLT`, `SLP`, `DJN`, etc.) and instruction modifiers.
- Addressing modes: the parser recognizes immediate (`#`), direct (no prefix or `$`), indirect (`@`) and a `<'` token used here to indicate a pre-decrement-style mode.
   - Indirect addressing is simplified and implemented as an "INDIRECT_B" style pointer that uses the B-field value of the pointed instruction. The official spec distinguishes A- and B-indirect behavior depending on which field is annotated.
   - Pre-decrement (`<`) is acknowledged in the parser but not fully implemented; it is treated as a direct/relative address in many places.
   - Immediate mode is simplified: rather than fully separating addresses vs immediate data semantics, immediate values are treated as relative offsets for address calculations in several places. (This is a known simplification.)
- Instruction modifiers (like `.A`, `.B`, `.AB`, `.F`, `.X`, `.I`) are not supported beyond a default `'I'` behavior. Arithmetic and moves operate with simplified semantics (e.g., `ADD` only updates the B-field value in the current implementation).
- JMP / SPL behavior: jumps and splits use the numeric field values as relative offsets without full resolution based on addressing mode or modifiers in some cases.
- MOV semantics: `MOV` of a non-immediate source copies the entire instruction at the source address to the destination address and assigns the copied instruction to the moving warrior (ownerId). `MOV #X, Y` (immediate-to-target) writes the immediate value into the destination instruction's B-field rather than generating a minimal instruction or a proper immediate cell as some ICWS variants do.
- Parsing and syntax:
   - Labels and named symbols are not supported.
   - Comments starting with `;` are supported and trimmed.
   - Numeric parsing is tolerant: missing or invalid numbers default to `0` (e.g., `MOV ,1` may treat the first operand as `0`).
- Memory and arithmetic:
   - Core size defaults to 8000 (standard), and some arithmetic results are reduced modulo the core size in places (this is a practical simplification used in the implementation).
- Process limits and bookkeeping:
   - `MAX_PROCESSES` is set to 8000 for safety in the UI; different tournament implementations may use other limits or disallow extremely large process counts.

If you need strict compatibility with the ICWS '94 specification or tournament-grade behavior, here's a short roadmap of what to add or change:

- Implement full addressing semantics for A vs B fields (A-indirect vs B-indirect), pre-/post-decrement semantics, and correct immediate handling so that immediate values are not treated as addresses.
- Support instruction modifiers (`.A`, `.B`, `.AB`, `.F`, `.X`, `.I`) and make each opcode obey modifier rules.
- Add the full opcode set from ICWS '86 and ICWS '94 (JMZ, JMN, SEQ, SNE, SLT, DJN, etc.).
- Improve parser robustness: support labels, error reporting, stricter number parsing, and proper handling of whitespace/line continuations.
- Add a configurable core size, configurable process limits, and an optional strict-mode where behaviors match a chosen official simulator.

References:

- ICWS / Core War resources: https://corewar.co.uk/ (official history and documentation)

If you'd like, I can open a PR to implement one of these compatibility improvements (for example, full instruction modifiers or correct A/B indirect semantics). Tell me which compatibility item you'd prefer and I'll add it to the project plan.

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
