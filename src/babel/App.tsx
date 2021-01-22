import React, { CSSProperties, FC } from 'react';
import styled from 'styled-components';

const Div: FC<React.HTMLProps<HTMLDivElement>> = styled.div``;
interface Props {
  className?: string;
  style?: CSSProperties;
}
export const App: FC<Props> = function (_props) {
  return <Div>{'那么'}<span>你好</span></Div>;
};
