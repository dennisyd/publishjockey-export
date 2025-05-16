function Image(img)
  -- Create markdown pipe table syntax as raw blocks
  local table_start = pandoc.RawBlock('markdown', '| ')
  local table_content = img
  local table_end = pandoc.RawBlock('markdown', ' |\n|:--:|')
  
  return {table_start, pandoc.Para({table_content}), table_end}
end