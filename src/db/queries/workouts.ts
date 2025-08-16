// Workout session-related queries
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { workoutSessions, workoutExercises, exerciseCatalog } from '../schema';

export class WorkoutQueries {
  private db: ReturnType<typeof drizzle>;

  constructor(database: SQLite.SQLiteDatabase) {
    this.db = drizzle(database);
  }

  /**
   * Get all workout sessions for a user
   */
  async getUserWorkoutSessions(userId: string) {
    try {
      return await this.db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.userId, userId))
        .orderBy(desc(workoutSessions.createdAt));
    } catch (error) {
      console.error('Error fetching user workout sessions:', error);
      throw error;
    }
  }

  /**
   * Get a specific workout session by ID
   */
  async getWorkoutSessionById(sessionId: string) {
    try {
      const result = await this.db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.id, sessionId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching workout session by ID:', error);
      throw error;
    }
  }

  /**
   * Get exercises for a specific workout session
   */
  async getWorkoutExercises(sessionId: string) {
    try {
      return await this.db
        .select({
          id: workoutExercises.id,
          exerciseId: workoutExercises.exerciseId,
          exerciseName: exerciseCatalog.name,
          kind: exerciseCatalog.kind,
          modality: exerciseCatalog.modality,
          orderPos: workoutExercises.orderPos,
          restSecDefault: workoutExercises.restSecDefault,
          notes: workoutExercises.notes,
          fromSplitExerciseId: workoutExercises.fromSplitExerciseId
        })
        .from(workoutExercises)
        .innerJoin(exerciseCatalog, eq(workoutExercises.exerciseId, exerciseCatalog.id))
        .where(eq(workoutExercises.sessionId, sessionId))
        .orderBy(workoutExercises.orderPos);
    } catch (error) {
      console.error('Error fetching workout exercises:', error);
      throw error;
    }
  }

  /**
   * Create a new workout session
   */
  async createWorkoutSession(data: {
    userId: string;
    splitId?: string;
    state?: string;
    plannedForDate?: string;
  }) {
    try {
      const result = await this.db
        .insert(workoutSessions)
        .values({
          userId: data.userId,
          splitId: data.splitId,
          state: data.state || 'active',
          plannedForDate: data.plannedForDate,
          startedAt: new Date()
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating workout session:', error);
      throw error;
    }
  }

  /**
   * Complete a workout session
   */
  async completeWorkoutSession(sessionId: string, note?: string) {
    try {
      const result = await this.db
        .update(workoutSessions)
        .set({
          state: 'completed',
          finishedAt: new Date(),
          note: note,
          updatedAt: new Date()
        })
        .where(eq(workoutSessions.id, sessionId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error completing workout session:', error);
      throw error;
    }
  }

  /**
   * Add exercise to workout session
   */
  async addExerciseToWorkout(data: {
    sessionId: string;
    exerciseId: string;
    orderPos: number;
    restSecDefault?: number;
    notes?: string;
    fromSplitExerciseId?: string;
  }) {
    try {
      const result = await this.db
        .insert(workoutExercises)
        .values({
          sessionId: data.sessionId,
          exerciseId: data.exerciseId,
          orderPos: data.orderPos,
          restSecDefault: data.restSecDefault,
          notes: data.notes,
          fromSplitExerciseId: data.fromSplitExerciseId
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error adding exercise to workout:', error);
      throw error;
    }
  }

  /**
   * Update workout exercise
   */
  async updateWorkoutExercise(workoutExerciseId: string, data: {
    orderPos?: number;
    restSecDefault?: number;
    notes?: string;
  }) {
    try {
      const result = await this.db
        .update(workoutExercises)
        .set(data)
        .where(eq(workoutExercises.id, workoutExerciseId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating workout exercise:', error);
      throw error;
    }
  }

  /**
   * Remove exercise from workout
   */
  async removeExerciseFromWorkout(workoutExerciseId: string) {
    try {
      await this.db
        .delete(workoutExercises)
        .where(eq(workoutExercises.id, workoutExerciseId));
      
      return true;
    } catch (error) {
      console.error('Error removing exercise from workout:', error);
      throw error;
    }
  }

  /**
   * Get workout sessions by state
   */
  async getWorkoutSessionsByState(userId: string, state: string) {
    try {
      return await this.db
        .select()
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, userId),
            eq(workoutSessions.state, state)
          )
        )
        .orderBy(desc(workoutSessions.createdAt));
    } catch (error) {
      console.error('Error fetching workout sessions by state:', error);
      throw error;
    }
  }

  /**
   * Get the last workout session for a user
   */
  async getLastWorkoutSession(userId: string) {
    try {
      const result = await this.db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.userId, userId))
        .orderBy(desc(workoutSessions.createdAt))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching last workout session:', error);
      throw error;
    }
  }

  /**
   * Get workout statistics for a user
   */
  async getWorkoutStats(userId: string) {
    try {
      // Get total workouts
      const totalWorkouts = await this.db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.userId, userId));

      // Get completed workouts (have finishedAt)
      const completedWorkouts = totalWorkouts.filter(session => session.finishedAt);

      // Calculate total workout time (in minutes)
      const totalWorkoutTime = completedWorkouts.reduce((total, session) => {
        if (session.finishedAt && session.startedAt) {
          const duration = session.finishedAt.getTime() - session.startedAt.getTime();
          return total + Math.round(duration / (1000 * 60)); // Convert to minutes
        }
        return total;
      }, 0);

      return {
        totalWorkouts: totalWorkouts.length,
        completedWorkouts: completedWorkouts.length,
        totalWorkoutTime, // in minutes
        averageWorkoutTime: completedWorkouts.length > 0 
          ? Math.round(totalWorkoutTime / completedWorkouts.length) 
          : 0
      };
    } catch (error) {
      console.error('Error fetching workout statistics:', error);
      throw error;
    }
  }
}
