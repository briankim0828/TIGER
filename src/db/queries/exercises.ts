// Exercise-related queries
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, like, or } from 'drizzle-orm';
import { exerciseCatalog } from '../schema';

export class ExerciseQueries {
  private db: ReturnType<typeof drizzle>;

  constructor(database: SQLite.SQLiteDatabase) {
    this.db = drizzle(database);
  }

  /**
   * Get all exercises
   */
  async getAllExercises() {
    try {
      return await this.db
        .select()
        .from(exerciseCatalog)
        .orderBy(exerciseCatalog.name);
    } catch (error) {
      console.error('Error fetching all exercises:', error);
      throw error;
    }
  }

  /**
   * Get exercises by kind (strength, cardio, etc.)
   */
  async getExercisesByKind(kind: string) {
    try {
      return await this.db
        .select()
        .from(exerciseCatalog)
        .where(eq(exerciseCatalog.kind, kind))
        .orderBy(exerciseCatalog.name);
    } catch (error) {
      console.error('Error fetching exercises by kind:', error);
      throw error;
    }
  }

  /**
   * Get exercises by modality (barbell, dumbbell, etc.)
   */
  async getExercisesByModality(modality: string) {
    try {
      return await this.db
        .select()
        .from(exerciseCatalog)
        .where(eq(exerciseCatalog.modality, modality))
        .orderBy(exerciseCatalog.name);
    } catch (error) {
      console.error('Error fetching exercises by modality:', error);
      throw error;
    }
  }

  /**
   * Search exercises by name
   */
  async searchExercises(searchTerm: string) {
    try {
      const searchPattern = `%${searchTerm}%`;
      return await this.db
        .select()
        .from(exerciseCatalog)
        .where(
          or(
            like(exerciseCatalog.name, searchPattern),
            like(exerciseCatalog.slug, searchPattern)
          )
        )
        .orderBy(exerciseCatalog.name);
    } catch (error) {
      console.error('Error searching exercises:', error);
      throw error;
    }
  }

  /**
   * Get exercise by ID
   */
  async getExerciseById(exerciseId: string) {
    try {
      const result = await this.db
        .select()
        .from(exerciseCatalog)
        .where(eq(exerciseCatalog.id, exerciseId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching exercise by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new exercise
   */
  async createExercise(data: {
    name: string;
    kind: string;
    modality: string;
    slug?: string;
    defaultRestSec?: number;
  }) {
    try {
      const result = await this.db
        .insert(exerciseCatalog)
        .values({
          name: data.name,
          slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
          kind: data.kind,
          modality: data.modality,
          defaultRestSec: data.defaultRestSec
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }
  }

  /**
   * Update an exercise
   */
  async updateExercise(exerciseId: string, data: {
    name?: string;
    kind?: string;
    modality?: string;
    defaultRestSec?: number;
  }) {
    try {
      const result = await this.db
        .update(exerciseCatalog)
        .set(data)
        .where(eq(exerciseCatalog.id, exerciseId))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }
  }

  /**
   * Delete an exercise
   */
  async deleteExercise(exerciseId: string) {
    try {
      await this.db
        .delete(exerciseCatalog)
        .where(eq(exerciseCatalog.id, exerciseId));
      
      return true;
    } catch (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  }

  /**
   * Get popular exercises (this could be enhanced with usage tracking)
   */
  async getPopularExercises(limit: number = 10) {
    try {
      // For now, just return exercises ordered by name
      // In the future, this could be enhanced with usage analytics
      return await this.db
        .select()
        .from(exerciseCatalog)
        .orderBy(exerciseCatalog.name)
        .limit(limit);
    } catch (error) {
      console.error('Error fetching popular exercises:', error);
      throw error;
    }
  }

  /**
   * Get unique exercise kinds
   */
  async getExerciseKinds() {
    try {
      const result = await this.db
        .selectDistinct({ kind: exerciseCatalog.kind })
        .from(exerciseCatalog)
        .orderBy(exerciseCatalog.kind);
      
      return result.map(row => row.kind);
    } catch (error) {
      console.error('Error fetching exercise kinds:', error);
      throw error;
    }
  }

  /**
   * Get unique exercise modalities
   */
  async getExerciseModalities() {
    try {
      const result = await this.db
        .selectDistinct({ modality: exerciseCatalog.modality })
        .from(exerciseCatalog)
        .orderBy(exerciseCatalog.modality);
      
      return result.map(row => row.modality);
    } catch (error) {
      console.error('Error fetching exercise modalities:', error);
      throw error;
    }
  }
}
