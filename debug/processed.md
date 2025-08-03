---
title: "book test"
author: "Dylan Dennis"
subtitle: "Cool book"
toc-title: "CONTENTS"
toc-depth: 1
geometry: "footskip=1.0in"
header-includes: |
  \setlength{\footskip}{1.0in}
  \usepackage{longtable}
  \setcounter{tocdepth}{1}
  % Override Pandoc's automatic chapter handling for front matter
  \let\oldchapter\chapter
  \newcommand{\frontmatterchapter}[1]{\oldchapter*{#1}\markboth{#1}{}}
---

```{=latex}
\frontmatter
\pagenumbering{roman}
```

```{=latex}
\clearpage
\thispagestyle{empty}
```

\begin{center} {\fontsize{24pt}{28pt}\selectfont\textbf{Book Test}} \end{center}

\begin{center} Cool Book \end{center}

\begin{center} Dylan Dennis \end{center}




```{=latex}
\clearpage
```

Copyright © 2025 Dylan Dennis

All rights reserved. No part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.

```{=latex}
\clearpage
\tableofcontents
\clearpage
```

\chapter*{Dedication}
\addcontentsline{toc}{chapter}{Dedication}

This is test dedication.

::: {.center}
Hi
:::

\chapter*{Acknowledgements}
\addcontentsline{toc}{chapter}{Acknowledgements}

This is a test acknowledgement

\chapter*{Introduction}
\addcontentsline{toc}{chapter}{Introduction}

This is a brief introduction.

\section*{Try level 2}

What is my name

\subsection*{Try level 3}

What is your name

```{=latex}
\mainmatter
\pagenumbering{arabic}
\setcounter{page}{1}
```

# The Brady Bunch

This is a short chapter 1.

\begin{center}
\includegraphics[width=0.25\textwidth]{https://res.cloudinary.com/dq6ngwhbq/image/upload/f_png,q_95/v1754180104/publishjockey/68085d116bf75556bb7894ac/687eae898dff87df5d086db5/1754180103843-HealingwithHerbsandFaith.jpg}
{itshape HealingwithHerbsandFaith}
\end{center}

Have a nice day.

# Chapter 2

This is a short chapter 2.

\begin{center}
\includegraphics[width=0.5\textwidth]{https://res.cloudinary.com/dq6ngwhbq/image/upload/f_png,q_95/v1754180737/publishjockey/68085d116bf75556bb7894ac/687eae898dff87df5d086db5/1754180736806-publishjockeylogo.png}
{itshape Publish Jockey Logo}
\end{center}