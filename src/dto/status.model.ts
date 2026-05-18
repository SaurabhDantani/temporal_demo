import { AllotmentStatusCodeEnum } from 'src/utils/enums/allotmentStatusCodeEnum';
import { AllotmentStatusEnum } from 'src/utils/enums/allotmentStatusEnum';

export class StatusModel {
  constructor(
    public readonly name: string,
    public readonly status: AllotmentStatusEnum,
    public readonly statusCode: AllotmentStatusCodeEnum,
    public readonly shareApplied: number,
    public readonly shareAlloted: number,
    public readonly isError = false,
  ) {}
}

export function serverErrorFunction() {
  return new StatusModel(
    '',
    AllotmentStatusEnum.SERVER_ERROR,
    AllotmentStatusCodeEnum.SERVER_ERROR,
    0,
    0,
    true,
  );
}

export function notAppliedFunction() {
  return new StatusModel(
    '',
    AllotmentStatusEnum.NOT_APPLIED,
    AllotmentStatusCodeEnum.NOT_APPLIED,
    0,
    0,
  );
}

export function notAllotedFunction(name: string, shareApplied: number) {
  return new StatusModel(
    name,
    AllotmentStatusEnum.NOT_ALLOTED,
    AllotmentStatusCodeEnum.NOT_ALLOTED,
    shareApplied,
    0,
  );
}

export function allotedFunction(
  name: string,
  shareApplied: number,
  shareAlloted: number,
) {
  return new StatusModel(
    name,
    AllotmentStatusEnum.ALLOTED,
    AllotmentStatusCodeEnum.ALLOTED,
    shareApplied,
    shareAlloted,
  );
}
