import { Data } from './data.model';

export class Result {
  constructor(
    public readonly issuccess: boolean,
    public readonly message: string,
    public readonly data: Data | null,
  ) {}
}
