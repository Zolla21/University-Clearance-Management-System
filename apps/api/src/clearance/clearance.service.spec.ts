
import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ClearanceItemStatus,
  ClearanceRequestStatus,
} from '@epsu/database';
import { ClearanceService } from './clearance.service';
import { ClearanceDecision } from './dto/review-clearance-item.dto';

describe('ClearanceService approval rules', () => {
  const txMock = {
    clearanceRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    approval: {
      create: jest.fn(),
    },
    clearanceItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(
      async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    ),
    clearanceItem: {
      findFirst: jest.fn(),
    },
  };

  const service = new ClearanceService(prismaMock as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ClearanceDecision.REJECTED,
    ClearanceDecision.RETURNED,
  ])(
    'requires a comment when the decision is %s',
    async (decision) => {
      await expect(
        service.reviewClearanceItem(
          'request-1',
          'item-1',
          'finance-1',
          ['FINANCE_OFFICER'],
          { decision, comment: '   ' },
        ),
      ).rejects.toThrow(
        'A comment is required when rejecting or returning an item.',
      );

      expect(prismaMock.clearanceItem.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it('blocks a Registrar from using ordinary item review', async () => {
    await expect(
      service.reviewClearanceItem(
        'request-1',
        'item-1',
        'registrar-1',
        ['REGISTRAR'],
        { decision: ClearanceDecision.APPROVED },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.clearanceItem.findFirst).not.toHaveBeenCalled();
  });

  it('blocks final approval for users without the Registrar role', async () => {
    await expect(
      service.finalizeClearanceRequest(
        'request-1',
        'staff-1',
        ['DEPARTMENT_STAFF'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('blocks Registrar final approval when a required item is unresolved', async () => {
    txMock.clearanceRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      status: ClearanceRequestStatus.IN_PROGRESS,
      items: [
        {
          status: ClearanceItemStatus.APPROVED,
          templateItem: { isRequired: true },
        },
        {
          status: ClearanceItemStatus.REJECTED,
          templateItem: { isRequired: true },
        },
      ],
      approvals: [],
    });

    await expect(
      service.finalizeClearanceRequest(
        'request-1',
        'registrar-1',
        ['REGISTRAR'],
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(txMock.approval.create).not.toHaveBeenCalled();
    expect(txMock.clearanceRequest.update).not.toHaveBeenCalled();
  });

  it('completes a request after Registrar approval when all required items are approved', async () => {
    const completedRequest = {
      id: 'request-1',
      status: ClearanceRequestStatus.COMPLETED,
    };

    txMock.clearanceRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      status: ClearanceRequestStatus.IN_PROGRESS,
      items: [
        {
          status: ClearanceItemStatus.APPROVED,
          templateItem: { isRequired: true },
        },
      ],
      approvals: [],
    });

    txMock.approval.create.mockResolvedValue({ id: 'approval-1' });
    txMock.clearanceRequest.update.mockResolvedValue(completedRequest);

    const result = await service.finalizeClearanceRequest(
      'request-1',
      'registrar-1',
      ['REGISTRAR'],
    );

    expect(txMock.approval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: 'request-1',
          clearanceItemId: null,
          approverId: 'registrar-1',
          status: ApprovalStatus.APPROVED,
        }),
      }),
    );

    expect(txMock.clearanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          status: ClearanceRequestStatus.COMPLETED,
        }),
      }),
    );

    expect(result).toEqual(completedRequest);
  });

  it('blocks Department staff from reviewing a Finance item', async () => {
    prismaMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'FINANCE', isActive: true },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    await expect(
      service.reviewClearanceItem(
        'request-1',
        'item-1',
        'department-staff-1',
        ['DEPARTMENT_STAFF'],
        { decision: ClearanceDecision.APPROVED },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('blocks Finance until Library, Property, and Dormitory are approved', async () => {
    prismaMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'FINANCE', isActive: true },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    txMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'FINANCE' },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    txMock.clearanceItem.findMany.mockResolvedValue([
      {
        status: ClearanceItemStatus.APPROVED,
        unit: { code: 'LIBRARY' },
        templateItem: { isRequired: true },
      },
      {
        status: ClearanceItemStatus.PENDING,
        unit: { code: 'PROPERTY' },
        templateItem: { isRequired: true },
      },
      {
        status: ClearanceItemStatus.APPROVED,
        unit: { code: 'DORMITORY' },
        templateItem: { isRequired: true },
      },
    ]);

    await expect(
      service.reviewClearanceItem(
        'request-1',
        'item-1',
        'finance-1',
        ['FINANCE_OFFICER'],
        { decision: ClearanceDecision.APPROVED },
      ),
    ).rejects.toThrow(
      'Finance clearance requires approved Library, Property, and Dormitory clearances.',
    );

    expect(txMock.clearanceItem.update).not.toHaveBeenCalled();
  });

  it('blocks Department until Finance is approved', async () => {
    prismaMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'DEPARTMENT', isActive: true },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    txMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'DEPARTMENT' },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    txMock.clearanceItem.findMany.mockResolvedValue([
      {
        status: ClearanceItemStatus.PENDING,
        unit: { code: 'FINANCE' },
        templateItem: { isRequired: true },
      },
    ]);

    await expect(
      service.reviewClearanceItem(
        'request-1',
        'item-1',
        'department-1',
        ['DEPARTMENT_STAFF'],
        { decision: ClearanceDecision.APPROVED },
      ),
    ).rejects.toThrow(
      'Department clearance requires approved Finance clearance.',
    );

    expect(txMock.clearanceItem.update).not.toHaveBeenCalled();
  });

  it('blocks College until Department is approved', async () => {
    prismaMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'COLLEGE', isActive: true },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    txMock.clearanceItem.findFirst.mockResolvedValue({
      id: 'item-1',
      status: ClearanceItemStatus.PENDING,
      unit: { code: 'COLLEGE' },
      request: { status: ClearanceRequestStatus.IN_PROGRESS },
    });

    txMock.clearanceItem.findMany.mockResolvedValue([
      {
        status: ClearanceItemStatus.PENDING,
        unit: { code: 'DEPARTMENT' },
        templateItem: { isRequired: true },
      },
    ]);

    await expect(
      service.reviewClearanceItem(
        'request-1',
        'item-1',
        'clearance-staff-1',
        ['CLEARANCE_STAFF'],
        { decision: ClearanceDecision.APPROVED },
      ),
    ).rejects.toThrow(
      'College clearance requires approved Department clearance.',
    );

    expect(txMock.clearanceItem.update).not.toHaveBeenCalled();
  });
});
