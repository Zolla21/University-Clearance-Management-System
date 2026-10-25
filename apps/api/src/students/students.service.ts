
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStudentDto) {
    try {
      return await this.prisma.student.create({
        data: {
          ...dto,
          dateOfBirth: dto.dateOfBirth
            ? new Date(dto.dateOfBirth)
            : undefined,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : undefined,
          graduationDate: dto.graduationDate
            ? new Date(dto.graduationDate)
            : undefined,
        },
        include: {
          department: true,
          program: true,
          batch: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A student with this student ID or linked user already exists',
        );
      }
      throw error;
    }
  }

  async findAll(
    search?: string,
    page = 1,
    limit = 10,
    active?: boolean,
  ) {
    const where = {
      ...(active !== undefined ? { isActive: active } : {}),
      ...(search
        ? {
            OR: [
              {
                studentId: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                firstName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                middleName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: {
          department: true,
          program: true,
          batch: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        department: true,
        program: true,
        batch: true,
        clearanceRequests: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.findOne(id);

    try {
      return await this.prisma.student.update({
        where: { id },
        data: {
          ...dto,
          dateOfBirth: dto.dateOfBirth
            ? new Date(dto.dateOfBirth)
            : undefined,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : undefined,
          graduationDate: dto.graduationDate
            ? new Date(dto.graduationDate)
            : undefined,
        },
        include: {
          department: true,
          program: true,
          batch: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'A student with this student ID or linked user already exists',
        );
      }
      throw error;
    }
  }

  async activate(id: string) {
    await this.findOne(id);

    return this.prisma.student.update({
      where: { id },
      data: { isActive: true },
      include: {
        department: true,
        program: true,
        batch: true,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);

    return this.prisma.student.update({
      where: { id },
      data: { isActive: false },
      include: {
        department: true,
        program: true,
        batch: true,
      },
    });
  }
}
