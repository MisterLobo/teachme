import { Test, TestingModule } from '@nestjs/testing';
import { BookingsResolver } from './bookings.resolver';

describe('BookingsResolver', () => {
  let resolver: BookingsResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingsResolver],
    }).compile();

    resolver = module.get<BookingsResolver>(BookingsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
