import { Repository, FindManyOptions, FindOneOptions, DeepPartial, ObjectLiteral } from 'typeorm';
import { createLogger } from '../../utils/logger';

export abstract class BaseRepository<T extends ObjectLiteral> {
  protected logger = createLogger(this.constructor.name);
  
  constructor(protected repository: Repository<T>) {}

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      return await this.repository.find(options);
    } catch (error) {
      this.logger.error('Failed to find all records', { error, options });
      throw error;
    }
  }

  async findById(id: string, options?: FindOneOptions<T>): Promise<T | null> {
    try {
      return await this.repository.findOne({
        where: { id } as any,
        ...options
      });
    } catch (error) {
      this.logger.error('Failed to find record by ID', { error, id, options });
      throw error;
    }
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      this.logger.error('Failed to find one record', { error, options });
      throw error;
    }
  }

  async create(data: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity);
    } catch (error) {
      this.logger.error('Failed to create record', { error, data });
      throw error;
    }
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    try {
      await this.repository.update(id, data as any);
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to update record', { error, id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.repository.delete(id);
      return (result.affected ?? 0) > 0;
    } catch (error) {
      this.logger.error('Failed to delete record', { error, id });
      throw error;
    }
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    try {
      return await this.repository.count(options);
    } catch (error) {
      this.logger.error('Failed to count records', { error, options });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.repository.count({
        where: { id } as any
      });
      return count > 0;
    } catch (error) {
      this.logger.error('Failed to check if record exists', { error, id });
      throw error;
    }
  }
}