import * as React from 'react';

import { Process as ProcessType, Signal } from '../../common/communication';
import { DebugServer } from '../server-comm';
import Button from './Button';
import ProcessRow from './ProcessRow';

type SignalsTabProps = {
    processes: ProcessType[];
    debugServer: DebugServer;
    pidColorMap: {[pid: number]: string};
};

function signalsToString(set: Signal[]): string {
    return set.map((sig) => Signal[sig]).join(', ');
}

export default function SignalsTab(props: SignalsTabProps): React.ReactElement {
    const [selectedSignal, setSelectedSignal] = React.useState<Signal>(Signal.SIGINT);
    return (
        <div className="processes-listing">
            {props.processes.map((proc) => (
                <ProcessRow
                    key={proc.pid}
                    process={proc}
                    debugServer={props.debugServer}
                    color={props.pidColorMap[proc.pid]}
                >
                    <div className="send-signal-controls">
                        Send signal:
                        <select
                            className="inline"
                            value={selectedSignal}
                            onChange={(e): void => setSelectedSignal(
                                Number(e.currentTarget.value),
                            )}
                        >
                            { Object.entries(Signal).map(([num, name]) => (
                                <option key={name} value={num}>{name}</option>
                            ))}
                        </select>
                        <Button
                            className="inline-small"
                            onClick={(): void => props.debugServer.sendSignal(
                                proc, selectedSignal,
                            )}
                            title="Send signal"
                        >
                            Send
                        </Button>
                    </div>

                    {(proc.blockedSignals.length || proc.pendingSignals.length || null) && (
                        <>
                            <p>Blocked signals: {signalsToString(proc.blockedSignals)}</p>
                            <p>Pending signals: {signalsToString(proc.pendingSignals)}</p>
                        </>
                    )}
                </ProcessRow>
            ))}
        </div>
    );
}
