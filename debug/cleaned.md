---
title: "Security Test Document"
author: "Security Test User"
toc-title: "CONTENTS"
geometry: "footskip=1.0in"
header-includes: |
  % Force larger footskip on ALL pages including frontmatter
  \setlength{\footskip}{1.0in}
  % Use same page style for ALL pages
  \pagestyle{plain}
  \usepackage{fancyhdr}
  \fancypagestyle{plain}{%
    \fancyhf{}
    \fancyfoot[C]{\thepage}
  }
  \fancypagestyle{empty}{%
    \fancyhf{}
    \fancyfoot[C]{\thepage}
  }
  \usepackage{longtable}
---

```{=latex}
\clearpage
\tableofcontents
\clearpage
```

```{=latex}
\mainmatter
\pagenumbering{arabic}
\setcounter{page}{1}
```

# Test Document

This is a test document for security testing.