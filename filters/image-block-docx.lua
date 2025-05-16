function Para(elem)
  if #elem.content == 1 and elem.content[1].t == "Image" then
    return elem
  end
end

function Image(img)
  if FORMAT == "docx" then
    return pandoc.Para{img}
  end
  return nil
end 