export type LatestRequestTicket = {
  generation: number;
  signal: AbortSignal;
};

/** Abort superseded requests and make response ownership explicit. */
export class LatestRequestGate {
  private generation = 0;
  private controller: AbortController | null = null;

  start(): LatestRequestTicket {
    this.controller?.abort();
    this.controller = new AbortController();
    this.generation += 1;
    return { generation: this.generation, signal: this.controller.signal };
  }

  isCurrent(ticket: LatestRequestTicket) {
    return ticket.generation === this.generation && !ticket.signal.aborted;
  }

  finish(ticket: LatestRequestTicket) {
    if (ticket.generation === this.generation) this.controller = null;
  }

  abort() {
    this.controller?.abort();
    this.controller = null;
    this.generation += 1;
  }
}
