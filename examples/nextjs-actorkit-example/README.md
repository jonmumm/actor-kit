# Actor Kit with Next.js Example

This example demonstrates how to use Actor Kit with Next.js to create a real-time, event-driven todo list application. Actor Kit provides a Redux-like approach with additional benefits such as event-safety, time-safety guarantees, persistence through snapshots, and efficient syncing using JSON patches.

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── todo/
│   │   │       └── route.ts  # Server-side Actor handling
│   │   ├── page.tsx          # Main page component
│   │   └── player-server.ts  # PartyKit player server
│   ├── components/
│   │   └── TodoList.tsx      # Todo list component
│   ├── lib/
│   │   ├── app-context.tsx   # Application context provider
│   │   └── app-machine.ts    # XState machine definition
│   └── server.ts             # Main PartyKit server
├── public/
├── package.json
├── partykit.json             # PartyKit configuration
└── next.config.mjs
```

## Key Components

1. **Server-side Actor**: `src/app/api/todo/route.ts`
   - Handles todo list actions using Actor Kit
   - Ensures event-safety and time-safety guarantees
   - Manages state persistence through snapshots

2. **Client-side Integration**: `src/app/page.tsx` and `src/components/TodoList.tsx`
   - Connects to the server using PartySocket
   - Manages local state and UI updates
   - Syncs with server using efficient JSON patches

3. **State Management**: `src/lib/app-context.tsx` and `src/lib/app-machine.ts`
   - Implements XState for client-side state management
   - Provides a context for easy state access across components

4. **PartyKit Integration**: `src/server.ts` and `src/app/player-server.ts`
   - Configures PartyKit for real-time communication
   - Handles player-specific logic

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Concepts

- **Event-Driven Architecture**: The application is built around a stream of events, ensuring predictable state transitions.
- **Time-Safety Guarantees**: Actor Kit ensures that transitions and side-effects occur in a controlled, deterministic manner.
- **Persistence**: State is persisted through snapshots, allowing for easy recovery and state management.
- **Efficient Syncing**: JSON patches are used for efficient state synchronization between client and server.
- **Real-time Updates**: PartyKit enables seamless real-time communication.
- **State Machine**: XState is used to manage the application's state and logic on the client-side.
- **Context Provider**: A custom AppContext provides easy access to the application state throughout the component tree.

## PartyKit Configuration

The `partykit.json` file configures the project for PartyKit:

```json
{
  "name": "todo-example",
  "main": "src/server.ts",
  "parties": {
    "todo": "src/app/player-server.ts"
  }
}
```

This setup allows for easy deployment and scaling of the real-time functionality.

## Learn More

For more details on Actor Kit and its integration with Next.js, refer to the main Actor Kit documentation.
```

This updated README emphasizes the event-driven nature of Actor Kit, its similarities to Redux (with additional benefits), and the key concepts of event-safety, time-safety, persistence, and efficient syncing. It also includes a more detailed project structure based on the Piqolo World example you provided, and mentions the PartyKit configuration.