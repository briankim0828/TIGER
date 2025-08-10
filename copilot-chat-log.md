# Copilot Chat Log

# 2025-08-10
Project Goal: Data Flow & Architecture Overhaul

The user wants to refactor the application's data architecture from its current state to a more robust, relational model.

**Current Problems:**
*   The data model relies on nested JSON structures with manually-defined, arbitrary TypeScript types in index.ts.
*   Data persistence is handled by `AsyncStorage` (data.ts), which acts as a simple key-value store, and is not relational.
*   State management (DataContext.tsx, WorkoutContext.tsx) is centered around holding large, in-memory copies of the data, which is inefficient and not scalable.
*   Synchronization with Supabase is manual and incomplete, used more as a backup than a source of truth.

**Target Architecture:**
*   **Database:** A local SQL database will be the single source of truth.
*   **Synchronization:** Use **ElectricSQL** to handle reactivity and bi-directional synchronization between the local database and the main Supabase Postgres database.
*   **ORM:** Use **Drizzle ORM** to define the database schema and execute queries. Types will be automatically generated from this schema.
*   **Data Flow:** The application will shift from a state-centric model to a database-centric one. UI components will subscribe directly to live queries from the local database, automatically re-rendering when data changes.

**High-Level Implementation Plan:**
1.  **Replace the Data Layer:**
    *   Discard data.ts and the manual types in index.ts.
    *   Define a new, normalized database schema using Drizzle.
    *   Configure ElectricSQL to manage the local database and sync with Supabase.
2.  **Refactor State Management:**
    *   Modify `DataContext` to provide the database client instead of holding data in state.
    *   Rewrite `WorkoutContext` so that its functions (`startWorkout`, `endWorkout`, etc.) perform transactional database operations directly, rather than manipulating an in-memory object.
3.  **Adapt UI Components:**
    *   Replace data fetching logic (`useData()`) in components with ElectricSQL's `useLiveQuery` hooks.
    *   Update component props to use the new, Drizzle-generated types.
    *   Connect user actions (button presses, etc.) to functions that execute database mutations via Drizzle.


