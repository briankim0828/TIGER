// Split-related queries
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, desc } from 'drizzle-orm';
import { splits, exercises as exerciseCatalog, splitExercises } from '../sqlite/schema';
import { generateUUID } from '../../utils/uuid';

export class SplitQueries {
  private db: ReturnType<typeof drizzle>;

  constructor(database: SQLite.SQLiteDatabase) {
    this.db = drizzle(database);
  }

  /**
   * Get all splits for a user
   */
  async getUserSplits(userId: string) {
    try {
      return await this.db
        .select()
        .from(splits)
        .where(eq(splits.userId, userId))
        .orderBy(desc(splits.createdAt));
    } catch (error) {
      console.error('Error fetching user splits:', error);
      throw error;
    }
  }

  /**
   * Get a specific split by ID
   */
  async getSplitById(splitId: string) {
    try {
      const result = await this.db
        .select()
        .from(splits)
        .where(eq(splits.id, splitId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching split by ID:', error);
      throw error;
    }
  }

  /**
   * Get exercises for a specific split
   */
  async getSplitExercises(splitId: string) {
    try {
      return await this.db
        .select({
          id: exerciseCatalog.id,
          name: exerciseCatalog.name,
          kind: exerciseCatalog.kind,
          modality: exerciseCatalog.modality,
          splitExerciseId: splitExercises.id,
          orderPos: splitExercises.orderPos,
          restSecDefault: splitExercises.restSecDefault,
          notes: splitExercises.notes
        })
        .from(splitExercises)
        .innerJoin(exerciseCatalog, eq(splitExercises.exerciseId, exerciseCatalog.id))
        .where(eq(splitExercises.splitId, splitId))
        .orderBy(splitExercises.orderPos);
    } catch (error) {
      console.error('Error fetching split exercises:', error);
      throw error;
    }
  }

  /**
   * Create a new split
   */
  async createSplit(data: {
    name: string;
    userId: string;
    color: string;
  }) {
    try {
      const result = await this.db
        .insert(splits)
        .values({
          id: generateUUID(),
          name: data.name,
          userId: data.userId,
          color: data.color,
          isActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating split:', error);
      throw error;
    }
  }

  /**
   * Update a split
   */
  async updateSplit(splitId: string, data: {
    name?: string;
    color?: string;
    isActive?: boolean;
  }) {
    try {
      const updatePayload: any = {
        updatedAt: new Date().toISOString(),
      };
      if (typeof data.name !== 'undefined') updatePayload.name = data.name;
      if (typeof data.color !== 'undefined') updatePayload.color = data.color;
      if (typeof data.isActive !== 'undefined') updatePayload.isActive = data.isActive ? 1 : 0;

      const result = await this.db
        .update(splits)
        .set(updatePayload)
        .where(eq(splits.id, splitId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating split:', error);
      throw error;
    }
  }

  /**
   * Delete a split
   */
  async deleteSplit(splitId: string) {
    try {
      // First delete associated split exercises
      await this.db
        .delete(splitExercises)
        .where(eq(splitExercises.splitId, splitId));
      
      // Then delete the split itself
      await this.db
        .delete(splits)
        .where(eq(splits.id, splitId));
      
      return true;
    } catch (error) {
      console.error('Error deleting split:', error);
      throw error;
    }
  }

  /**
   * Add exercise to split
   */
  async addExerciseToSplit(data: {
    splitId: string;
    exerciseId: string;
    orderPos: number;
    restSecDefault?: number;
    notes?: string;
  }) {
    try {
      const result = await this.db
        .insert(splitExercises)
        .values({
          id: generateUUID(),
          splitId: data.splitId,
          exerciseId: data.exerciseId,
          orderPos: data.orderPos,
          restSecDefault: data.restSecDefault,
          notes: data.notes
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error adding exercise to split:', error);
      throw error;
    }
  }

  /**
   * Remove exercise from split
   */
  async removeExerciseFromSplit(splitExerciseId: string) {
    try {
      await this.db
        .delete(splitExercises)
        .where(eq(splitExercises.id, splitExerciseId));
      
      return true;
    } catch (error) {
      console.error('Error removing exercise from split:', error);
      throw error;
    }
  }
}
