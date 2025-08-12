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


# 2025-08-12

### **Project Plan: Application Data Architecture Overhaul**

#### **Checkpoint 0 — Foundations & Tooling**

This initial step prepares the project with foundational utilities and dependencies, setting the stage for the new architecture without altering existing logic.

1.  **Install Core Dependencies:**
    *   **Action:** Modify package.json to add the required packages for the new stack.
    *   **Command:**
        ```bash
        npm install drizzle-orm electric-sql @electric-sql/react-native @electric-sql/drizzle-orm-driver uuid
        npm install --save-dev drizzle-kit tsx @types/uuid
        ```

2.  **Establish Foundational Utilities:**
    *   **Action:** Create a utility for generating client-side UUIDs. This ensures all new entities have unique, sync-friendly primary keys.
    *   **File to Create:** `src/utils/uuid.ts` to export a function that generates v4 UUIDs.
    *   **Action:** Update ids.ts to use this new UUID generator, deprecating its existing logic.

3.  **Configure Tooling:**
    *   **Action:** Create `drizzle.config.ts` in the root directory. This file will point `drizzle-kit` to your Supabase database for generating migrations and to the schema definition file.

---

#### **Checkpoint 1 — Model Definition & Generation**

Here, we define the canonical data model using Drizzle, from which all database tables, migrations, and application types will be derived.

1.  **Define the Schema:**
    *   **Action:** Create the single source of truth for your data model.
    *   **File to Create:** `src/db/schema.ts`.
    *   **Details:** Based on the conceptual model you will provide, define all tables (`users`, `splits`, `exercises`, `workouts`, etc.) using Drizzle's `pgTable` syntax. All `id` columns will be of type `uuid`.

2.  **Generate Types and Migrations:**
    *   **Action:** Run `drizzle-kit` to generate the initial SQL migration script and the corresponding TypeScript types.
    *   **Result:** This process validates the schema and creates the first migration file in a new `drizzle` directory. The generated types will replace the hand-written ones in index.ts later.

---

#### **Checkpoint 2 — Local DB & Sync Integration**

This checkpoint focuses on wiring up the local database and the synchronization engine, making the database available to the entire application.

1.  **Initialize ElectricSQL:**
    *   **Action:** Create a provider to manage the ElectricSQL client and the connection to the local database.
    *   **File to Create:** `src/electric/provider.tsx`. This component will initialize the client, open the database, run migrations, and provide the electrified Drizzle instance via React Context.

2.  **Integrate Provider into the App:**
    *   **Action:** Wrap the application's root with the new provider.
    *   **File to Modify:** App.tsx. The `<ElectricProvider>` will be placed high in the component tree, ensuring all screens and components can access the database.

3.  **Create Data Access Layer:**
    *   **Action:** Create a new directory `src/db/queries` to hold functions that interact with the database.
    *   **Files to Create:** Start with `src/db/queries/splits.ts` and `src/db/queries/exercises.ts`. These will contain functions like `getSplits`, `addSplit`, `getExercises`, etc., which use the Drizzle client.

---

#### **Checkpoint 3 — Refactor the "Program Builder" Flow**

This is the first feature to be migrated. We will swap out the data handling for `MySplits` and `SplitDetailScreen` to use the new local database.

1.  **Adapt UI Components:**
    *   **Files to Modify:** `src/screens/MySplits.tsx` and SplitDetailScreen.tsx.
    *   **Action:** Replace data fetching from `useData()` with ElectricSQL's `useLiveQuery` hook, calling the query functions created in the previous step (e.g., `useLiveQuery(db.query.splits.findMany())`).
    *   **Action:** Update all button presses and actions (create, update, delete) to call the new mutation functions (e.g., `addSplit(db, newSplit)`).

2.  **Deprecate Old State Management:**
    *   **File to Modify:** DataContext.tsx.
    *   **Action:** Remove the state variables (`splits`, `exercises`) and data manipulation functions related to the program builder. The context becomes much leaner, as components now get their data directly from the database.

---

#### **Checkpoint 4 — Refactor "Start Workout" & Live Logging**

This checkpoint tackles the core interactive feature: running a workout. We will refactor the `WorkoutContext` to be a set of transactional database operations.

1.  **Rewrite Workout Logic:**
    *   **File to Modify:** WorkoutContext.tsx.
    *   **Action:** The `startWorkout` function will now be a database transaction that creates a `workouts` record and its associated `workout_exercises`. It will no longer create a large in-memory object.
    *   **Action:** Functions like `addSet` and `updateSet` will become atomic mutations that write directly to the `workout_sets` table in the local database.
    *   **Action:** `endWorkout` will simply update the status and duration of the `workouts` record.

2.  **Adapt Workout UI:**
    *   **Files to Modify:** WorkoutScreen.tsx and ActiveWorkoutModal.tsx.
    *   **Action:** The UI will use `useLiveQuery` to subscribe to the currently active workout, its exercises, and its sets.
    *   **Action:** The component will no longer hold workout data in React state. It will only need the `workout_id` to fetch the relevant data. As `addSet` and other functions update the database, the UI will re-render automatically.

---

#### **Checkpoint 5 — Retire Legacy Systems**

With all features migrated, we can now safely remove the old, obsolete code.

1.  **Remove `AsyncStorage` Persistence:**
    *   **Action:** Delete data.ts. All its functionality is now handled by the local database.

2.  **Remove Manual Types:**
    *   **Action:** Delete index.ts. The entire application will now use the types generated by Drizzle from `src/db/schema.ts`.

3.  **Clean Up Supabase Integration:**
    *   **Action:** Review the files in supabase. The Supabase client will likely be kept for authentication, but all functions related to manual data fetching and writing (`supabaseSplits.ts`, `supabaseWorkout.ts`, etc.) will be deleted.

4.  **Finalize Context Cleanup:**
    *   **Action:** Delete DataContext.tsx entirely, as its responsibilities have been fully absorbed by direct database queries in the components.

---

#### **Checkpoint 6 — Cloud Deployment & Verification**

The final step is to set up the cloud environment and ensure everything syncs correctly.

1.  **Initialize Cloud Database:**
    *   **Action:** Create a new, empty project in Supabase.
    *   **Action:** Apply the Drizzle-generated migrations to the cloud database to create the table structure.

2.  **Configure Row-Level Security (RLS):**
    *   **Action:** In Supabase, define RLS policies on all tables to ensure users can only access their own data. Policies will typically check that `auth.uid() == user_id`.

3.  **End-to-End Sync Test:**
    *   **Action:** Run the application and verify that data created locally is correctly synced to the Supabase project. Test offline capabilities by disabling network access, making changes, and then re-enabling to watch the sync complete.