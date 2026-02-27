import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import ZoomableImage from '@site/src/components/ZoomableImage';

export default {
  ...MDXComponents,
  img: (props) => <ZoomableImage {...props} />,
};