export class Data {
  constructor(
    public readonly panId: string,
    public readonly panName: string,
    public readonly panNumber: string,
    public readonly status: string,
    public readonly statusCode: number,
    public readonly shareApplied: number,
    public readonly shareAlloted: number,
  ) {}
}
