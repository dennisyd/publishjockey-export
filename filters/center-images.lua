-- filters/center-images.lua
function Para(elem)
  -- If the paragraph contains only an image, center it
  if #elem.content == 1 and elem.content[1].t == "Image" then
    return pandoc.Para(elem.content, pandoc.Attr("", {}, {["style"] = "text-align:center;"}))
  end
end