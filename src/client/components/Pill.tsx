import * as React from 'react';
import classNames from 'classnames';

type PillProps = {
    text: string;
    color?: string;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
};

const Pill: React.FunctionComponent<PillProps> = (props: PillProps) => {
    const style = {
        backgroundColor: props.color,
        ...props.style,
    };
    return (
        <div className={classNames('pill', props.className)} style={style}>
            <div className="pill-text">{props.text}</div>
            {props.children}
        </div>
    );
};

export default Pill;
