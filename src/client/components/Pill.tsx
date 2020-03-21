import * as React from 'react';
import classNames from 'classnames';

type PillProps = {
    text: string;
    color?: string;
    className?: string;
    style?: React.CSSProperties;
};

const Pill: React.FunctionComponent<PillProps> = (props: PillProps) => {
    const style = {
        backgroundColor: props.color,
        ...props.style,
    };
    return (
        <div className={classNames('pill', props.className)} style={style}>
            {props.text}
        </div>
    );
};

export default Pill;
